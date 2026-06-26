'use client';
// components/ui/Accordion.tsx
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionItem {
  question: string;
  answer: string;
}

export default function Accordion({ items }: { items: AccordionItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    // Single continuous border — not repeated cards
    <div className="border border-tactical-border rounded-lg overflow-hidden">
      {items.map((item, i) => {
        const isOpen = openIndex === i;

        return (
          <div
            key={i}
            className={[
              'bg-canvas-surface',
              i > 0 ? 'border-t border-tactical-border' : '',
            ].join(' ')}
          >
            {/* Trigger */}
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left group"
            >
              <span className="font-display font-semibold text-base text-pearl-text leading-snug">
                {item.question}
              </span>
              <ChevronDown
                size={18}
                strokeWidth={2}
                className={[
                  'shrink-0 text-muted-text transition-transform duration-300 ease-out',
                  'group-hover:text-pearl-text',
                  isOpen ? 'rotate-180 text-pearl-text' : 'rotate-0',
                ].join(' ')}
              />
            </button>

            {/* Collapsible body — grid-rows for smooth height animation */}
            <div
              className={[
                'grid transition-all duration-300 ease-out',
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              ].join(' ')}
            >
              <div className="overflow-hidden">
                <p className="max-w-prose font-sans text-sm text-muted-text leading-relaxed px-6 pb-6">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
