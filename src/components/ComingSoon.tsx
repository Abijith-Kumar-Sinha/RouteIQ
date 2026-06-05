export default function ComingSoon({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-[#22304f] bg-panel text-2xl">
          🚧
        </div>
        <h2 className="text-2xl font-bold text-ink">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#22304f] bg-panel px-4 py-1.5 text-xs text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-visited)]" />
          In progress
        </div>
      </div>
    </div>
  )
}
