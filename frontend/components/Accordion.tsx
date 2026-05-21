'use client';

import { useState } from 'react';

interface AccordionItem {
  question: string;
  answer: string;
}

export default function Accordion({ items }: { items: AccordionItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={i}
            className={`bg-slate-canvas border rounded-xl overflow-hidden transition-colors duration-200 ${
              isOpen ? 'border-refreshing-teal' : 'border-clean-border hover:border-muted-text'
            }`}
          >
            {/* Trigger */}
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <span className="font-display font-semibold text-[15px] text-starlight-text leading-snug">
                {item.question}
              </span>
              <span
                className={`shrink-0 transition-transform duration-300 ${
                  isOpen ? 'rotate-45 text-refreshing-teal' : 'rotate-0 text-muted-text'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="9" y1="3" x2="9" y2="15" />
                  <line x1="3" y1="9" x2="15" y2="9" />
                </svg>
              </span>
            </button>

            {/* Collapsible body — grid-rows trick for smooth animation without inline styles */}
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <p className="font-sans text-sm text-muted-text leading-relaxed px-6 pb-5">
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
