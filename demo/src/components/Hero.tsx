export function Hero() {
  return (
    <header className="text-center mb-12 relative">
      {/* Glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-violet-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[200px] bg-fuchsia-500/10 rounded-full blur-[80px] pointer-events-none" />
      
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6 animate-fade-in">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
        </span>
        <span className="text-sm text-violet-300 font-medium">Free & Open Source</span>
      </div>

      {/* Logo/Title row */}
      <div className="flex items-center justify-center gap-4 mb-4 animate-slide-up">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl blur-xl opacity-50 animate-pulse-slow" />
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        </div>
        <div className="text-left">
          <h1 className="text-4xl md:text-5xl font-bold gradient-text tracking-tight">
            repkg-rs
          </h1>
          <p className="text-sm text-slate-400 font-medium -mt-1">Wallpaper Engine Toolkit</p>
        </div>
        
      </div>

      {/* Subtitle */}
      <p className="text-slate-400 text-base md:text-lg max-w-lg mx-auto leading-relaxed animate-fade-in" style={{ animationDelay: '0.1s' }}>
        Extract images, videos & animations from Wallpaper Engine{' '}
        <span className="text-white font-medium">PKG</span> and{' '}
        <span className="text-white font-medium">TEX</span> files — 
        fast, free & completely private.
      </p>
      
      {/* Tech badges */}
      <div className="flex items-center justify-center gap-3 mt-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <span className="badge">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.687 11.709l-10.313-10.015c-.567-.551-1.207-.694-1.748-.694-.648 0-1.19.209-1.748.694L.313 11.709c-.418.407-.418 1.073 0 1.48l10.313 10.015c.567.551 1.207.694 1.748.694.648 0 1.19-.209 1.748-.694l10.313-10.015c.418-.407.418-1.073 0-1.48z"/>
          </svg>
          Rust
        </span>
        <span className="badge">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0l10.392 6v12L12 24 1.608 18V6L12 0zm0 2.311L3.608 7.311v9.378L12 21.689l8.392-5V7.311L12 2.311z"/>
          </svg>
          WebAssembly
        </span>
        <span className="badge-pink badge">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Browser-only
        </span>
      </div>

      {/* GitHub CTA */}
      <div className="mt-8 animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <a
          href="https://github.com/KibbeWater/repkg-rs"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-slate-800/60 border border-slate-700/50 hover:border-violet-500/30 hover:bg-slate-800 transition-all duration-300"
        >
          <svg className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Star on GitHub</span>
        </a>
      </div>
    </header>
  );
}
