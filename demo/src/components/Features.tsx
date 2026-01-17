const features = [
  {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: 'Private',
    description: 'Files stay in your browser',
  },
  {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Fast',
    description: 'Rust + WebAssembly',
  },
  {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'CLI Available',
    href: 'https://github.com/KibbeWater/repkg-rs/releases',
  },
];

export function Features() {
  return (
    <section className="my-10">
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 px-6 py-4 rounded-2xl bg-slate-900/40 border border-white/5">
        {features.map((feature, index) => (
          <div key={feature.title} className="flex items-center gap-x-8">
            {feature.href ? (
              <a
                href={feature.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 text-slate-400 hover:text-white transition-colors"
              >
                <span className="text-violet-400">{feature.icon}</span>
                <span className="text-sm font-medium">{feature.title}</span>
                <svg className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-violet-400">{feature.icon}</span>
                <div>
                  <span className="text-sm font-medium text-slate-200">{feature.title}</span>
                  {feature.description && (
                    <span className="text-sm text-slate-500 ml-2 hidden sm:inline">{feature.description}</span>
                  )}
                </div>
              </div>
            )}
            
            {index < features.length - 1 && (
              <div className="hidden sm:block w-px h-4 bg-slate-700/50" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
