import { Construction } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/**
 * Placeholder scaffold for modules that are wired into navigation but not yet
 * fully built. Keeps every sidebar link resolvable and communicates intent.
 */
export function ComingSoon({
  title,
  description,
  icon,
  planned,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  planned?: string[];
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {description ??
              "This Project Sentinel module is on the roadmap. The API and explainability contract are defined; the interface is being assembled."}
          </p>
        </div>
        <Badge variant="warning">Planned</Badge>
      </div>

      <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-overlay text-sentinel-300">
          {icon ?? <Construction size={26} />}
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          {title} — coming soon
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Every recommendation in this module will ship with a full,
          audit-ready explanation trace, consistent with the rest of the
          platform.
        </p>

        {planned?.length ? (
          <ul className="mt-5 grid w-full max-w-md gap-2 text-left sm:grid-cols-2">
            {planned.map((p) => (
              <li
                key={p}
                className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground"
              >
                {p}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 flex gap-2">
          <Link href="/dashboard">
            <Button variant="secondary" size="sm">
              Back to dashboard
            </Button>
          </Link>
          <Link href="/control-tower">
            <Button variant="outline" size="sm">
              Open control tower
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
