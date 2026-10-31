export default function FooterCredit() {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[12px] text-ink-soft">
      <span>GitHoop by <a href="https://github.com/HaoPhuc" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-brand">Phuc Huynh</a>.</span>
      <span>Based on <a href="https://github.com/younesfdj/gitfutbol" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-brand">GitFut</a>.</span>
      <a href="https://github.com/HaoPhuc/githoop/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-brand">MIT licensed</a>
    </p>
  );
}
