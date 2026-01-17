import { useState, useCallback } from 'react';

export function FindFiles() {
  const [copied, setCopied] = useState(false);
  const [steamCmdExpanded, setSteamCmdExpanded] = useState(false);

  const windowsPath = 'C:\\Program Files (x86)\\Steam\\steamapps\\workshop\\content\\431960';

  const copyPath = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(windowsPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  return (
    <section className="my-10">
      <div className="glass-card overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/5 px-6 py-4 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Where to Find Your Files
          </h3>
        </div>

        <div className="p-6">
          {/* Two column layout on larger screens */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left: File Path */}
            <div>
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs flex items-center justify-center font-bold">1</span>
                Find the Workshop Folder
              </h4>
              <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-400 mb-2">Default Steam location:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-violet-300 bg-slate-900 rounded-lg px-3 py-2 overflow-x-auto font-mono">
                    {windowsPath}
                  </code>
                  <button
                    onClick={copyPath}
                    className="flex-shrink-0 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors border border-white/5"
                  >
                    {copied ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Copied
                      </span>
                    ) : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Instructions */}
            <div>
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs flex items-center justify-center font-bold">2</span>
                Locate Your Wallpaper
              </h4>
              <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5 space-y-2">
                <p className="text-xs text-slate-300">
                  Each numbered folder = one wallpaper
                </p>
                <p className="text-xs text-slate-300">
                  Look for <code className="text-violet-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono">scene.pkg</code> inside
                </p>
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Folder number matches the Steam Workshop URL ID
                </p>
              </div>
            </div>
          </div>

          {/* SteamCMD Accordion */}
          <div className="mt-6 pt-4 border-t border-white/5">
            <button
              onClick={() => setSteamCmdExpanded(!steamCmdExpanded)}
              className="flex items-center justify-between w-full text-left group"
            >
              <span className="text-sm text-slate-400 group-hover:text-white transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Alternative: Download via SteamCMD
              </span>
              <svg className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${steamCmdExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {steamCmdExpanded && (
              <div className="mt-4 space-y-4 animate-fade-in">
                <p className="text-sm text-slate-400">
                  Download wallpapers using SteamCMD. Requires a Steam account that owns Wallpaper Engine.
                </p>

                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-sm">1</div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-white mb-1">Download SteamCMD</h5>
                    <p className="text-sm text-slate-400">
                      Get the official tool from Valve:{' '}
                      <a
                        href="https://developer.valvesoftware.com/wiki/SteamCMD#Downloading_SteamCMD"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300 transition-colors"
                      >
                        Download SteamCMD
                      </a>
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-sm">2</div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-white mb-1">Login to Steam</h5>
                    <p className="text-sm text-slate-400 mb-2">
                      Run <code className="text-violet-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono">steamcmd.exe</code>, wait for updates, then login:
                    </p>
                    <div className="bg-slate-900 rounded-lg px-4 py-2 font-mono text-sm inline-block border border-white/5">
                      <span className="text-slate-500">Steam&gt;</span>{' '}
                      <span className="text-white">login</span>{' '}
                      <span className="text-emerald-400">your_username</span>{' '}
                      <span className="text-emerald-400">your_password</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Steam Guard will prompt for a code if enabled.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-sm">3</div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-white mb-1">Download a Wallpaper</h5>
                    <p className="text-sm text-slate-400 mb-2">
                      Find the <span className="text-emerald-400">Workshop ID</span> from the wallpaper's Steam URL:
                    </p>
                    <div className="bg-slate-950/50 rounded-lg p-3 mb-2 text-sm border border-white/5">
                      <p className="text-slate-500 break-all mb-2 font-mono text-xs">
                        steamcommunity.com/sharedfiles/filedetails/?id=<span className="text-emerald-400 font-semibold">2927857034</span>
                      </p>
                      <p className="text-slate-400 text-xs">
                        The ID is the number at the end: <span className="text-emerald-400 font-semibold">2927857034</span>
                      </p>
                    </div>
                    <p className="text-sm text-slate-400 mb-2">Then run:</p>
                    <div className="bg-slate-900 rounded-lg px-4 py-2 font-mono text-sm inline-block border border-white/5">
                      <span className="text-slate-500">Steam&gt;</span>{' '}
                      <span className="text-white">workshop_download_item</span>{' '}
                      <span className="text-violet-400">431960</span>{' '}
                      <span className="text-emerald-400">2927857034</span>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-sm">4</div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-white mb-1">Find Your Files</h5>
                    <p className="text-sm text-slate-400 mb-2">
                      The wallpaper downloads to:
                    </p>
                    <div className="bg-slate-900 rounded-lg px-4 py-2 font-mono text-xs break-all border border-white/5">
                      <span className="text-slate-500">steamcmd/steamapps/workshop/content/</span><span className="text-violet-400">431960</span><span className="text-slate-500">/</span><span className="text-emerald-400">2927857034</span><span className="text-slate-500">/</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-2">
                      Grab <code className="text-violet-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono">scene.pkg</code> from inside and drop it above!
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-500 pl-12 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <code className="text-violet-400">431960</code> is Wallpaper Engine's App ID — always use this number.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
