import { EmptyState } from "../components/EmptyState";

export function PlaceholderPage({ title, description, action }) {
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-6">
          <EmptyState title={`No ${title} Records`} description={description} action={action} />
        </div>
      </section>
    </div>
  );
}
