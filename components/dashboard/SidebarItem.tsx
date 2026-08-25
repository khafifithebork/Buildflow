"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";


interface SidebarItemProps {
    href: string;
    title: string;
    icon: LucideIcon;
    onClick?: () => void;
}

export default function SidebarItem({ href, title, icon: Icon, onClick }: SidebarItemProps) {
    const pathname = usePathname();
    const isActive = pathname === href;
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const isDark = resolvedTheme === "dark"

    return (
        <Link
            href={href}
            onClick={onClick}
            className="
                relative
                w-[90%]
                h-12
                rounded-xl
                flex
                items-center
                gap-3
                px-4
                my-1
                text-content-muted
                text-sm
                hover:text-content-muted
                hover:bg-surface-hover
                dark:hover:text-zinc-100
                dark:hover:bg-white/5
            
                transition-colors
                group
            "
        >
            {isActive && (
                <motion.div
                    layoutId="active-pill"
                    className="absolute inset-0 bg-white dark:text-zinc-100 dark:bg-accent dark:border dark:border-accent rounded-xl -z-10 shadow-sm"
                    transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30
                    }}
                />
            )}

            <div className="flex justify-center w-7 h-7 min-w-7 rounded-md items-center shadow-sm">
                <Icon size={16} color={isDark ? "white" : "gray"} strokeWidth={2} />
            </div>
            <span className={`font-medium ${isActive ? "text-zinc-900 dark:text-zinc-100 font-semibold" : ""}`}>
                {title}
            </span>
        </Link>
    );
}
