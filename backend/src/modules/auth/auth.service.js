import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPrisma } from "../../config/db.js";
import { env } from "../../config/env.js";

const ROLE_PERMISSIONS = {
  OWNER: ["*"],
  ADMIN: ["company:read", "company:update", "branches:read", "branches:create", "branches:update", "branches:delete", "users:read", "users:create", "users:update", "users:delete", "products:read", "products:create", "products:update", "products:delete", "audit:read"],
  STORE_KEEPER: ["company:read", "branches:read", "products:read", "products:create", "products:update", "audit:read"],
  ACCOUNTANT: ["company:read", "branches:read", "products:read", "audit:read"],
  SALES_MANAGER: ["company:read", "branches:read", "products:read", "audit:read"],
  SALESMAN: ["company:read", "branches:read", "products:read"],
  PURCHASE_MANAGER: ["company:read", "branches:read", "products:read", "audit:read"],
  PRODUCTION_OPERATOR: ["company:read", "branches:read", "products:read"],
  HR_MANAGER: ["company:read", "branches:read", "users:read", "users:create", "users:update", "audit:read"],
};

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function permissionsFor(user) {
  const names = user.userRoles?.map((userRole) => userRole.role?.name).filter(Boolean) || ["OWNER"];
  return [...new Set(names.flatMap((name) => ROLE_PERMISSIONS[name] || []))];
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      tenantId: user.tenantId,
      companyId: user.companyId,
      email: user.email,
      permissions: permissionsFor(user),
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_EXPIRES_IN },
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      tenantId: user.tenantId,
      companyId: user.companyId,
      email: user.email,
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN },
  );
}

export async function registerTenant(input) {
  const prisma = getPrisma();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const tenantSlug = `${slugify(input.tenantName)}-${Date.now()}`;

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        tenantId: crypto.randomUUID(),
        name: input.tenantName,
        slug: tenantSlug,
      },
    });

    const company = await tx.company.create({
      data: {
        tenantId: tenant.id,
        companyId: crypto.randomUUID(),
        name: input.companyName,
        legalName: input.legalName,
        gstin: input.gstin,
      },
    });

    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        companyId: company.id,
        name: input.ownerName,
        email: input.ownerEmail.toLowerCase(),
        phone: input.ownerPhone,
        passwordHash,
      },
    });

    const role = await tx.role.create({
      data: {
        tenantId: tenant.id,
        companyId: company.id,
        name: "OWNER",
        description: "Business owner with full ERP access",
        createdBy: owner.id,
        updatedBy: owner.id,
      },
    });

    await tx.userRole.create({
      data: {
        tenantId: tenant.id,
        companyId: company.id,
        userId: owner.id,
        roleId: role.id,
        createdBy: owner.id,
        updatedBy: owner.id,
      },
    });

    const userWithRoles = await tx.user.findUnique({
      where: { id: owner.id },
      include: { userRoles: { include: { role: true } } },
    });

    return {
      tenant,
      company,
      user: userWithRoles,
      accessToken: signAccessToken(userWithRoles),
      refreshToken: signRefreshToken(owner),
    };
  });
}

export async function loginUser(email, password) {
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), isDeleted: false, isActive: true },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

export function refreshAccessToken(refreshToken) {
  const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  return jwt.sign(
    {
      sub: payload.sub,
      tenantId: payload.tenantId,
      companyId: payload.companyId,
      email: payload.email,
      permissions: payload.permissions || [],
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_EXPIRES_IN },
  );
}
