import { Crosshair, MoveVertical, Repeat } from 'lucide-react';

/** The Advanced tools, shared by the header menu and the footer */
export const advancedLinks = [
    { href: "/advanced/range", label: "Range Swaps", hint: "Sell high, buy back low, on a schedule", icon: MoveVertical },
    { href: "/advanced/in-and-out", label: "In & Out", hint: "Buy a token now, sell it at a profit later", icon: Crosshair },
    { href: "/advanced/dca", label: "DCA", hint: "Buy a little at a time, on a schedule", icon: Repeat },
];
