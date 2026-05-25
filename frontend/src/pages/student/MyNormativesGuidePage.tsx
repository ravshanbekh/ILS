import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { settingsApi } from '@/api';
import { PlayCircle, BookOpen, Shield, Loader2, ExternalLink, CheckCircle2, Info } from 'lucide-react';

interface TutorialVideo {
  title: string;
  youtubeUrl: string;
  description: string;
}

interface TutorialVideos {
  platformRules: TutorialVideo;
  normativeRules: TutorialVideo;
  obsStudio?: TutorialVideo;
  youtubeChannel?: TutorialVideo;
}

/**
 * YouTube URL dan embed URL ga aylantirish
 */
function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  
  let videoId = '';

  // youtube.com/watch?v=xxx
  const watchMatch = url.match(/[?&]v=([^&#]+)/);
  if (watchMatch) {
    videoId = watchMatch[1];
  }

  // youtu.be/xxx
  const shortMatch = url.match(/youtu\.be\/([^?&#]+)/);
  if (shortMatch) {
    videoId = shortMatch[1];
  }

  // youtube.com/embed/xxx (already embed)
  const embedMatch = url.match(/youtube\.com\/embed\/([^?&#]+)/);
  if (embedMatch) {
    videoId = embedMatch[1];
  }

  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}

function getYouTubeThumbnail(url: string): string | null {
  if (!url) return null;
  let videoId = '';
  const watchMatch = url.match(/[?&]v=([^&#]+)/);
  if (watchMatch) videoId = watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([^?&#]+)/);
  if (shortMatch) videoId = shortMatch[1];
  const embedMatch = url.match(/youtube\.com\/embed\/([^?&#]+)/);
  if (embedMatch) videoId = embedMatch[1];
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

export default function MyNormativesGuidePage() {
  const [videos, setVideos] = useState<TutorialVideos | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<'platform' | 'normative' | 'obs' | 'ytchannel' | null>(null);

  useEffect(() => {
    settingsApi.getTutorialVideos()
      .then((res) => setVideos(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  const platformEmbedUrl = videos?.platformRules?.youtubeUrl
    ? getYouTubeEmbedUrl(videos.platformRules.youtubeUrl)
    : null;

  const normativeEmbedUrl = videos?.normativeRules?.youtubeUrl
    ? getYouTubeEmbedUrl(videos.normativeRules.youtubeUrl)
    : null;

  const obsEmbedUrl = videos?.obsStudio?.youtubeUrl
    ? getYouTubeEmbedUrl(videos.obsStudio.youtubeUrl)
    : null;

  const ytChannelEmbedUrl = videos?.youtubeChannel?.youtubeUrl
    ? getYouTubeEmbedUrl(videos.youtubeChannel.youtubeUrl)
    : null;

  const hasAnyVideo = platformEmbedUrl || normativeEmbedUrl || obsEmbedUrl || ytChannelEmbedUrl;

  return (
    <div>
      <Header title="Qoidalar va Ko'rsatmalar" subtitle="Platforma qoidalari va normativ ko'rsatmalari" />

      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">

        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-indigo-600/20 border border-blue-500/20 p-6 sm:p-8">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-1">
                Qoidalar va Ko'rsatmalar
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-xl">
                Quyidagi videolarni ko'rib chiqing — platforma qoidalari va normativlarni bajarish
                tartibi bilan tanishing. Bu sizga tizimdan samarali foydalanishga yordam beradi.
              </p>
            </div>
          </div>
          {/* Decorative blurs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full translate-x-1/3 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 blur-3xl rounded-full -translate-x-1/3 translate-y-1/2"></div>
        </div>

        {!hasAnyVideo ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-5">
              <Info className="w-8 h-8 text-zinc-500" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-400 mb-2">
              Videolar hali joylashtirilmagan
            </h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto">
              Admin tomonidan ko'rsatma videolar joylashtirilgandan so'ng, ular shu yerda ko'rinadi.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Video 1: Platforma ishlatish qoidalari */}
            <VideoCard
              number={1}
              title={videos?.platformRules?.title || 'Platforma ishlatish qoidalari'}
              description={videos?.platformRules?.description || 'Platformadan foydalanish bo\'yicha qo\'llanma video'}
              embedUrl={platformEmbedUrl}
              youtubeUrl={videos?.platformRules?.youtubeUrl || ''}
              isActive={activeVideo === 'platform'}
              onActivate={() => setActiveVideo('platform')}
              icon={<Shield className="w-5 h-5" />}
              gradient="from-blue-500 to-cyan-500"
              accentColor="blue"
            />

            {/* Video 2: Normativ qoidalari bajarish */}
            <VideoCard
              number={2}
              title={videos?.normativeRules?.title || 'Normativ qoidalari bajarish'}
              description={videos?.normativeRules?.description || 'Normativlarni qanday bajarish kerakligi haqida video'}
              embedUrl={normativeEmbedUrl}
              youtubeUrl={videos?.normativeRules?.youtubeUrl || ''}
              isActive={activeVideo === 'normative'}
              onActivate={() => setActiveVideo('normative')}
              icon={<CheckCircle2 className="w-5 h-5" />}
              gradient="from-emerald-500 to-teal-500"
              accentColor="emerald"
            />

            {/* Video 3: OBS Studio */}
            {obsEmbedUrl && (
              <VideoCard
                number={3}
                title={videos?.obsStudio?.title || 'OBS Studio o\'rnatish va sozlash'}
                description={videos?.obsStudio?.description || 'OBS Studio dasturini o\'rnatish va sozlash bo\'yicha qo\'llanma'}
                embedUrl={obsEmbedUrl}
                youtubeUrl={videos?.obsStudio?.youtubeUrl || ''}
                isActive={activeVideo === 'obs'}
                onActivate={() => setActiveVideo('obs')}
                icon={<PlayCircle className="w-5 h-5" />}
                gradient="from-purple-500 to-violet-500"
                accentColor="purple"
              />
            )}

            {/* Video 4: YouTube kanal */}
            {ytChannelEmbedUrl && (
              <VideoCard
                number={4}
                title={videos?.youtubeChannel?.title || 'YouTube kanal ochish va video joylash'}
                description={videos?.youtubeChannel?.description || 'YouTube kanalini qanday ochish va video joylash bo\'yicha qo\'llanma'}
                embedUrl={ytChannelEmbedUrl}
                youtubeUrl={videos?.youtubeChannel?.youtubeUrl || ''}
                isActive={activeVideo === 'ytchannel'}
                onActivate={() => setActiveVideo('ytchannel')}
                icon={<BookOpen className="w-5 h-5" />}
                gradient="from-red-500 to-rose-500"
                accentColor="red"
              />
            )}
          </div>
        )}

        {/* Tips Section */}
        {hasAnyVideo && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              Eslatmalar
            </h3>
            <ul className="space-y-3">
              {[
                'Videolarni to\'liq ko\'rib chiqing, keyin normativlarni bajarishga o\'ting',
                'Har bir normativ bajarilganda video ko\'rsatmaga rioya qiling',
                'Savollar bo\'lsa, o\'qituvchingizga murojaat qiling',
              ].map((tip, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-zinc-400">
                  <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold border border-blue-500/20">
                    {idx + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ VideoCard Component ============

interface VideoCardProps {
  number: number;
  title: string;
  description: string;
  embedUrl: string | null;
  youtubeUrl: string;
  isActive: boolean;
  onActivate: () => void;
  icon: React.ReactNode;
  gradient: string;
  accentColor: string;
}

function VideoCard({
  number,
  title,
  description,
  embedUrl,
  youtubeUrl,
  isActive,
  onActivate,
  icon,
  gradient,
  accentColor,
}: VideoCardProps) {
  if (!embedUrl) return null;

  const thumbnail = getYouTubeThumbnail(youtubeUrl);

  return (
    <div className="group bg-[#18181b] border border-zinc-800 rounded-2xl overflow-hidden transition-all duration-300 hover:border-zinc-700 hover:shadow-xl hover:shadow-black/20">
      {/* Video Player / Thumbnail */}
      <div className="relative aspect-video bg-[#09090b] overflow-hidden">
        {isActive ? (
          <iframe
            src={embedUrl}
            title={title}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            onClick={onActivate}
            className="absolute inset-0 w-full h-full flex items-center justify-center cursor-pointer group/btn"
          >
            {thumbnail && (
              <img
                src={thumbnail}
                alt={title}
                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover/btn:opacity-80 transition-opacity duration-500"
              />
            )}
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
            {/* Play Button */}
            <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 group-hover/btn:scale-110 group-hover/btn:bg-white/20 transition-all duration-300 shadow-2xl">
              <PlayCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            {/* Bottom text on thumbnail */}
            <div className="absolute bottom-4 left-4 right-4 z-10">
              <p className="text-xs text-white/60 font-medium">Ko'rish uchun bosing</p>
            </div>
          </button>
        )}
      </div>

      {/* Card Info */}
      <div className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shrink-0 shadow-lg`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-${accentColor}-500/10 text-${accentColor}-500 border border-${accentColor}-500/20`}>
                Video #{number}
              </span>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight leading-snug">
              {title}
            </h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/50">
          {!isActive ? (
            <button
              onClick={onActivate}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r ${gradient} text-white text-sm font-semibold hover:opacity-90 transition-all duration-200 shadow-lg`}
            >
              <PlayCircle className="w-4 h-4" />
              Videoni ko'rish
            </button>
          ) : (
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 text-sm font-semibold border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              Video ijro etilmoqda
            </div>
          )}
          {youtubeUrl && (
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all duration-200 shrink-0"
              title="YouTube'da ochish"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
