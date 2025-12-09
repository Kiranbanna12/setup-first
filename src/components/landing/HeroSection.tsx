
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { MagneticWrapper } from "@/components/shared/MagneticWrapper";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, PerspectiveCamera, Environment, Stars } from "@react-three/drei";
import * as THREE from "three";

// 3D Elements - Video Editing Theme

const FloatingElement = ({ position, rotationSpeed, floatIntensity, scale, type, color }: any) => {
    const mesh = useRef<THREE.Mesh>(null);
    const [hovered, setHover] = useState(false);

    // Randomize initial phase to desync animations
    const initialPhase = useRef(Math.random() * 10);
    // Randomize parallax direction and intensity
    const parallaxFactor = useRef((Math.random() - 0.5) * 3);

    useFrame((state, delta) => {
        if (mesh.current) {
            // Independent rotation
            mesh.current.rotation.x += delta * rotationSpeed * 0.5;
            mesh.current.rotation.y += delta * rotationSpeed;

            // Independent Mouse Parallax
            // We use the computed parallaxFactor to ensure each element moves differently
            const targetX = position[0] + (state.mouse.x * parallaxFactor.current);
            const targetY = position[1] + (state.mouse.y * parallaxFactor.current);

            mesh.current.position.x = THREE.MathUtils.lerp(mesh.current.position.x, targetX, 0.05);
            mesh.current.position.y = THREE.MathUtils.lerp(mesh.current.position.y, targetY, 0.05);
        }
    });

    React.useEffect(() => {
        if (mesh.current) {
            const targetScale = scale || 1;
            mesh.current.scale.set(0, 0, 0); // Set initial state
            gsap.to(mesh.current.scale, {
                x: targetScale,
                y: targetScale,
                z: targetScale,
                duration: 1.5,
                ease: "elastic.out(1, 0.5)",
                delay: Math.random() * 0.5 + 0.5 // Initial delay to wait for page load
            });
        }
    }, [scale]);

    const getGeometry = () => {
        switch (type) {
            case "video-panel": // 16:9 Aspect Ratio Panel
                return <boxGeometry args={[3, 1.7, 0.1]} />;
            case "timeline-strip": // Long thin strip
                return <boxGeometry args={[4, 0.4, 0.05]} />;
            case "tool-icon": // Rounded Cubeish
                return <boxGeometry args={[0.8, 0.8, 0.8]} />;
            default:
                return <icosahedronGeometry args={[1, 0]} />;
        }
    };

    return (
        <Float
            speed={floatIntensity}
            rotationIntensity={rotationSpeed}
            floatIntensity={floatIntensity}
        >
            <mesh
                ref={mesh}
                position={position}
                scale={scale || 1}
                onPointerOver={() => setHover(true)}
                onPointerOut={() => setHover(false)}
            >
                {getGeometry()}
                <meshStandardMaterial
                    color={color}
                    metalness={0.8}
                    roughness={0.2}
                    emissive={color}
                    emissiveIntensity={hovered ? 0.8 : 0.1}
                    transparent
                    opacity={0.6}
                />
            </mesh>
        </Float>
    );
};

const Scene = () => {
    const starsRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        if (starsRef.current) {
            starsRef.current.rotation.y += delta * 0.05; // Slow continuous rotation
            starsRef.current.rotation.x += delta * 0.02;
        }
    });

    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 0, 15]} />
            <ambientLight intensity={0.5} />
            <spotLight position={[20, 20, 20]} angle={0.25} penumbra={1} intensity={2} color="#ecfdf5" />
            <pointLight position={[-10, -10, -10]} intensity={1} color="#059669" />
            <pointLight position={[10, -5, 5]} intensity={1} color="#34d399" />

            <group ref={starsRef}>
                <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
            </group>

            {/* Editing Elements scattered in depth */}

            {/* Main Video Panel (Left) */}
            <FloatingElement
                type="video-panel"
                position={[-6, 3, -2]}
                color="#6366f1"
                speed={1}
                rotationSpeed={0.2}
                floatIntensity={1.5}
            />

            {/* Secondary Video Panel (Right, deeper) */}
            <FloatingElement
                type="video-panel"
                position={[8, -4, -8]}
                color="#a855f7"
                rotationSpeed={0.1}
                floatIntensity={1}
                scale={1.5}
            />

            {/* Timeline Strip (Center-ish, crossing) */}
            <FloatingElement
                type="timeline-strip"
                position={[0, -5, -4]}
                color="#ec4899"
                rotationSpeed={0.3}
                floatIntensity={2}
            />

            {/* Timeline Strip (Top Right) */}
            <FloatingElement
                type="timeline-strip"
                position={[6, 5, -5]}
                color="#3b82f6"
                rotationSpeed={0.2}
                floatIntensity={1.2}
            />

            {/* Floating Tool Icons (Scattered) */}
            <FloatingElement
                type="tool-icon"
                position={[-4, -2, 2]}
                color="#f43f5e"
                rotationSpeed={0.5}
                floatIntensity={2.5}
                scale={0.5}
            />
            <FloatingElement
                type="tool-icon"
                position={[5, 1, 3]}
                color="#10b981"
                rotationSpeed={0.6}
                floatIntensity={2}
                scale={0.4}
            />

            <Environment preset="night" />
        </>
    );
};

export const HeroSection = () => {
    const containerRef = useRef(null);
    const titleRef = useRef(null);
    const subtitleRef = useRef(null);
    const ctaRef = useRef(null);

    useGSAP(
        () => {
            const tl = gsap.timeline();

            tl.from(titleRef.current, {
                y: 100,
                opacity: 0,
                duration: 1.2,
                ease: "power4.out",
            })
                .from(subtitleRef.current, {
                    y: 30,
                    opacity: 0,
                    duration: 1,
                    ease: "power3.out",
                }, "-=0.8")
                .from(ctaRef.current, {
                    scale: 0.9,
                    opacity: 0,
                    duration: 0.8,
                    ease: "back.out(1.7)",
                }, "-=0.6");
        },
        { scope: containerRef }
    );

    return (
        <section
            ref={containerRef}
            className="relative min-h-screen flex flex-col items-center justify-center pt-20 overflow-hidden bg-zinc-950 text-white"
        >
            {/* 3D Background */}
            <div className="absolute inset-0 z-0">
                <Canvas gl={{ antialias: true }}>
                    <Scene />
                </Canvas>
            </div>

            {/* Overlay to ensure text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-950/20 to-zinc-950/10 z-0 pointer-events-none" />

            <div className="container relative z-10 mx-auto px-4 text-center">
                <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-colors cursor-pointer group">
                    <Sparkles className="w-4 h-4 text-yellow-400 group-hover:rotate-12 transition-transform" />
                    <span className="text-sm font-medium tracking-wide">V2.0 is Live: AI-Powered Workflows</span>
                </div>

                <h1
                    ref={titleRef}
                    className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight mb-8"
                >
                    <span className="block bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                        Xrozen
                    </span>
                    <span className="block bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500 animate-gradient-x">
                        Workflow
                    </span>
                </h1>

                <p
                    ref={subtitleRef}
                    className="text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto mb-12 leading-relaxed font-light"
                >
                    The ultimate project management OS for <span className="text-white font-medium">Video Editors & Agencies</span>.
                    <br className="hidden md:block" />
                    Manage versions, clients, invoices, and feedback—all in one zero-latency workspace.
                </p>

                <div
                    ref={ctaRef}
                    className="flex flex-col sm:flex-row gap-6 justify-center items-center"
                >
                    <MagneticWrapper intensity={0.5}>
                        <Button
                            size="lg"
                            className="h-16 px-10 text-xl rounded-full bg-white text-zinc-950 hover:bg-white/90 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)] hover:scale-105"
                            onClick={() => (window.location.href = "/auth")}
                        >
                            Get Started Free
                            <ArrowRight className="ml-2 w-6 h-6" />
                        </Button>
                    </MagneticWrapper>

                    <MagneticWrapper intensity={0.3}>
                        <Button
                            variant="outline"
                            size="lg"
                            className="h-16 px-10 text-xl rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/40 transition-all backdrop-blur-sm"
                            onClick={() => console.log("Download Clicked")}
                        >
                            <Play className="mr-3 w-5 h-5 fill-current" />
                            Download App
                        </Button>
                    </MagneticWrapper>
                </div>
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce opacity-50">
                <span className="text-xs tracking-widest uppercase">Scroll</span>
                <div className="w-[1px] h-12 bg-gradient-to-b from-white to-transparent" />
            </div>
        </section>
    );
};
