import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Linkedin } from 'lucide-react';

import Image from 'next/image';

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn('bg-[#060c18] relative overflow-hidden pt-32 pb-16', className)}>
       
       {/* Faded Background Image */}
       <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
         <Image 
           src="/footer-bg.jpg" 
           alt="Footer Background" 
           fill 
           className="object-cover opacity-60 [mask-image:linear-gradient(to_bottom,transparent_0%,black_40%,black_100%)]" 
           priority
         />
       </div>

       <div className="container relative z-10 flex flex-col md:flex-row justify-between gap-16 lg:gap-24">
          
          {/* LEFT SIDE - Typography & Navigation */}
          <div className="flex flex-col max-w-md shrink-0">
             
             {/* Logo Marker */}
             <div className="mb-6 flex items-center">
                <span className="text-orange-500 font-black text-5xl italic tracking-tighter" style={{ fontFamily: 'Impact, sans-serif' }}>
                  TM
                </span>
             </div>
             
             {/* Bold Headline */}
             <h2 className="text-white text-[32px] md:text-[40px] font-bold leading-[1.1] mb-12 tracking-tight drop-shadow-lg">
               The Future of TCG<br />is Tactical
             </h2>

             {/* Links Grid */}
             <div className="grid grid-cols-2 gap-x-8 gap-y-5 mb-16">
                <Link href="/privacy" className="text-zinc-300 hover:text-white transition-colors text-[15px] drop-shadow-md">Legal Notice</Link>
                <Link href="/contact" className="text-zinc-300 hover:text-white transition-colors text-[15px] drop-shadow-md">Support</Link>
                
                <Link href="/privacy" className="text-zinc-300 hover:text-white transition-colors text-[15px] drop-shadow-md">Privacy Policy</Link>
                <div /> 
                
                <Link href="/terms" className="text-zinc-300 hover:text-white transition-colors text-[15px] col-start-1 drop-shadow-md">Terms of Use</Link>
             </div>

             {/* Copyright */}
             <p className="text-zinc-400 text-sm drop-shadow-md">
                © {new Date().getFullYear()} TCG Master. ALL RIGHT RESERVED
             </p>
          </div>
       </div>
    </footer>
  );
}
