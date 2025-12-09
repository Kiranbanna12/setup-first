
import React, { useRef, ReactElement } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface MagneticWrapperProps {
    children: ReactElement;
    className?: string;
    intensity?: number; // Strength of the pull (0.5 is standard)
}

export const MagneticWrapper = ({ children, className = "", intensity = 0.5 }: MagneticWrapperProps) => {
    const magnetic = useRef<HTMLDivElement>(null);

    useGSAP(() => {
        const element = magnetic.current;
        if (!element) return;

        const xTo = gsap.quickTo(element, "x", { duration: 1, ease: "elastic.out(1, 0.3)" });
        const yTo = gsap.quickTo(element, "y", { duration: 1, ease: "elastic.out(1, 0.3)" });

        const handleMouseMove = (e: MouseEvent) => {
            const { clientX, clientY } = e;
            const { height, width, left, top } = element.getBoundingClientRect();

            const x = clientX - (left + width / 2);
            const y = clientY - (top + height / 2);

            xTo(x * intensity);
            yTo(y * intensity);
        };

        const handleMouseLeave = () => {
            xTo(0);
            yTo(0);
        };

        element.addEventListener("mousemove", handleMouseMove);
        element.addEventListener("mouseleave", handleMouseLeave);

        return () => {
            element.removeEventListener("mousemove", handleMouseMove);
            element.removeEventListener("mouseleave", handleMouseLeave);
        };
    }, { scope: magnetic });

    return (
        <div ref={magnetic} className={`relative inline-block ${className}`}>
            {/* Clone child to ensure it receives the ref driven events if needed, 
                 but typically the wrapper handles the movement of the whole block. 
                 The expanded hit area logic from the user prompt suggests a larger area capturing events.
                 However, for a button wrapper, moving the button itself is usually the goal.
                 We'll stick to moving the wrapper which contains the button. 
             */}
            {React.cloneElement(children)}
        </div>
    );
};
