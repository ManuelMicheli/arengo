import type { LegalBlock } from "@/lib/legal";

// **grassetto** → <strong>; il resto è testo semplice (React fa l'escape).
function Inline({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

export function LegalText({ blocks, headingOffset = 0 }: { blocks: LegalBlock[]; headingOffset?: 0 | 1 }) {
  return blocks.map((b, i) => {
    if (b.kind === "ul")
      return (
        <ul key={i} className="list-disc pl-5">
          {b.items.map((item, j) => (
            <li key={j}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );
    if (b.kind === "h1")
      return headingOffset ? (
        <h3 key={i} className="font-semibold">
          {b.text}
        </h3>
      ) : (
        <h2 key={i} className="text-xl font-semibold">
          {b.text}
        </h2>
      );
    if (b.kind === "h2")
      return (
        <h4 key={i} className="font-semibold">
          {b.text}
        </h4>
      );
    return (
      <p key={i}>
        <Inline text={b.text} />
      </p>
    );
  });
}
