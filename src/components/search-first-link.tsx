"use client";

// "Cerca se esiste già": apre /cerca con il testo del campo indicato, senza suggerimenti automatici.
export function SearchFirstLink({ inputId }: { inputId: string }) {
  function open() {
    const value = (document.getElementById(inputId) as HTMLInputElement | null)?.value.trim() ?? "";
    window.open(`/cerca?q=${encodeURIComponent(value)}`, "_blank", "noopener");
  }
  return (
    <button type="button" onClick={open} className="self-start underline">
      Cerca se esiste già
    </button>
  );
}
