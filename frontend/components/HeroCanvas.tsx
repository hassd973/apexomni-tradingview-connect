import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Props {
  onCanvasRef?: (el: HTMLCanvasElement | null) => void;
}

const HeroCanvas = ({ onCanvasRef }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const material = new THREE.MeshStandardMaterial({ color: '#38bdf8', wireframe: true });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(10, 10, 10);
    scene.add(light);
    camera.position.z = 5;

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const pointerMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      mesh.rotation.x = y * 0.5;
      mesh.rotation.y = x * 0.8;
    };
    window.addEventListener('pointermove', pointerMove);

    const animate = () => {
      mesh.rotation.z += 0.005;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', pointerMove);
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={(el) => {
        canvasRef.current = el;
        onCanvasRef?.(el);
      }}
      className="w-full h-[40vh]"
    />
  );
};

export default HeroCanvas;
