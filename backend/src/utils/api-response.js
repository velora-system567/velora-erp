export function ok(res, data = {}, message = "Success", meta = {}) {
  return res.json({ success: true, data, message, meta });
}

export function created(res, data = {}, message = "Created") {
  return res.status(201).json({ success: true, data, message, meta: {} });
}

export function fail(res, statusCode, message, data = {}) {
  return res.status(statusCode).json({ success: false, data, message, meta: {} });
}
