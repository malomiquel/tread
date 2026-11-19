"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { IoChevronForward } from "react-icons/io5";
import { defineStrings, useStrings } from "@tread/core/i18n";

const strings = defineStrings({ fr: { start: "Pour commencer" }, en: { start: "Get started" } });

export interface EmptyAction {
  title: string;
  detail: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}

/** Every empty page: a rule, "Get started", then cards of fixed height, the first one blue. */
export function EmptyState({ actions, note }: { actions: EmptyAction[]; note?: ReactNode }) {
  const s = useStrings(strings);
  return (
    <section>
      <div className="empty-rule" />
      <p className="group-label">{s.start}</p>
      <div className="action-cards">
        {actions.map((action) => {
          const body = (
            <>
              <span aria-hidden style={{ display: "grid", placeItems: "center", width: 28 }}>{action.icon}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <h3>{action.title}</h3>
                <p>{action.detail}</p>
              </span>
              {action.primary ? null : <IoChevronForward className="chevron" aria-hidden />}
            </>
          );
          const className = `action-card press${action.primary ? " primary" : ""}`;
          return action.href ? (
            <Link key={action.title} href={action.href} className={className}>{body}</Link>
          ) : (
            <button key={action.title} type="button" className={className} onClick={action.onClick}>{body}</button>
          );
        })}
      </div>
      {note ? <p className="note">{note}</p> : null}
    </section>
  );
}
