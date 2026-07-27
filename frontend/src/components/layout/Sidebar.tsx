"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  BrainCircuit,
  Building2,
  ChevronDown,
  ClipboardList,
  Cog,
  Dna,
  FileText,
  FlaskConical,
  GitBranch,
  GitFork,
  Grid3x3,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  ListTree,
  Network,
  Radar,
  ScrollText,
  ShieldAlert,
  Sparkles,
  UsersRound,
  Waypoints,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/useUIStore";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    title: "Command",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/control-tower", label: "Control Tower", icon: Grid3x3 },
      { href: "/portfolio", label: "Portfolio", icon: Boxes },
      { href: "/executive", label: "Executive View", icon: Building2 },
    ],
  },
  {
    title: "Intake & Planning",
    items: [
      { href: "/intake", label: "Project Intake", icon: ClipboardList },
      { href: "/gap-analysis", label: "Gap Analysis", icon: Radar },
      { href: "/project-summary", label: "Project Summary", icon: FileText },
      { href: "/wbs", label: "Work Breakdown", icon: ListTree },
      { href: "/methodology", label: "Methodology", icon: Workflow },
      { href: "/project-dna", label: "Project DNA", icon: Dna },
    ],
  },
  {
    title: "Schedule",
    items: [
      { href: "/timeline", label: "Timeline", icon: Waypoints },
      { href: "/gantt", label: "Gantt", icon: BarChart3 },
      { href: "/dependencies", label: "Dependencies", icon: GitFork },
      { href: "/resources", label: "Resources", icon: Boxes },
      { href: "/team-planner", label: "Team Planner", icon: UsersRound },
    ],
  },
  {
    title: "Risk & Health",
    items: [
      { href: "/health", label: "Health", icon: Heart },
      { href: "/risks", label: "Risk Register", icon: AlertTriangle },
      { href: "/recovery", label: "Recovery", icon: LifeBuoy },
      { href: "/rescue", label: "Rescue Mode", icon: ShieldAlert },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: "/simulation", label: "Digital Twin Lab", icon: FlaskConical },
      { href: "/explainability", label: "Explainability", icon: BrainCircuit },
      { href: "/knowledge-graph", label: "Knowledge Graph", icon: Network },
      { href: "/lessons-learned", label: "Lessons Learned", icon: Sparkles },
    ],
  },
  {
    title: "Reporting",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/meeting-minutes", label: "Meeting Minutes", icon: ScrollText },
      { href: "/audit", label: "Audit Trail", icon: GitBranch },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/settings", label: "Settings", icon: Cog },
      { href: "/admin", label: "Admin", icon: Activity },
    ],
  },
];

const COLLAPSE_STORAGE_KEY = "sentinel-sidebar-collapsed";

function isActive(pathname: string | null, href: string): boolean {
  return (
    pathname === href || (href !== "/dashboard" && Boolean(pathname?.startsWith(href)))
  );
}

/** Which section contains the current route — always expanded, even if collapsed by the user. */
function sectionForPath(pathname: string | null): string | undefined {
  return SECTIONS.find((s) => s.items.some((i) => isActive(pathname, i.href)))?.title;
}

export function Sidebar() {
  const pathname = usePathname();
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen);
  const closeMobileNav = useUIStore((s) => s.closeMobileNav);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Load collapsed-section preferences once on mount (client-only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {
      // ignore malformed/inaccessible storage
    }
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  const activeSection = sectionForPath(pathname);

  const toggleSection = (title: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage failures (private browsing, quota, etc.)
      }
      return next;
    });
  };

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {SECTIONS.map((section) => {
        const isCollapsed = Boolean(collapsed[section.title]) && section.title !== activeSection;
        return (
          <div key={section.title}>
            <button
              type="button"
              onClick={() => toggleSection(section.title)}
              className="focus-ring flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left"
              aria-expanded={!isCollapsed}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.title}
              </span>
              <ChevronDown
                size={13}
                className={cn(
                  "text-muted-foreground/60 transition-transform",
                  isCollapsed ? "-rotate-90" : "rotate-0",
                )}
              />
            </button>
            {isCollapsed ? null : (
              <ul className="space-y-0.5 pb-3">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={`${section.title}-${item.href}-${item.label}`}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                          active
                            ? "bg-sentinel-600/15 font-medium text-sentinel-200"
                            : "text-muted-foreground hover:bg-surface-overlay hover:text-foreground",
                        )}
                      >
                        <Icon
                          size={16}
                          className={cn(
                            active
                              ? "text-sentinel-300"
                              : "text-muted-foreground group-hover:text-foreground",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex h-14 items-center gap-2 border-b border-border px-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sentinel-600 shadow-glow">
        <Radar size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight text-foreground">
          Project Sentinel
        </p>
        <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
          Control Tower
        </p>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t border-border px-4 py-3">
      <p className="text-[10px] text-muted-foreground">
        v1.0 · Explainable by design
      </p>
    </div>
  );

  return (
    <>
      {/* Desktop: static sidebar, always visible at md+ */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* Mobile: overlay drawer, toggled from the TopNav hamburger button */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeMobileNav}
            aria-hidden="true"
          />
          <aside className="animate-fade-in absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-panel">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sentinel-600 shadow-glow">
                  <Radar size={18} className="text-white" />
                </div>
                <p className="text-sm font-semibold text-foreground">Project Sentinel</p>
              </div>
              <button
                type="button"
                onClick={closeMobileNav}
                aria-label="Close menu"
                className="focus-ring rounded-md p-1.5 text-muted-foreground hover:bg-surface-overlay hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      ) : null}
    </>
  );
}
