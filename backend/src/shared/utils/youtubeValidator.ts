/**
 * YouTube URL validatsiyasi
 */

const YOUTUBE_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?$/;

/**
 * YouTube URL haqiqiy ekanligini tekshirish
 */
export const isValidYoutubeUrl = (url: string): boolean => {
  return YOUTUBE_REGEX.test(url.trim());
};

/**
 * YouTube video ID ni ajratib olish
 */
export const extractYoutubeVideoId = (url: string): string | null => {
  const match = url.trim().match(YOUTUBE_REGEX);
  return match ? match[1] : null;
};

/**
 * YouTube thumbnail URL yasash
 */
export const getYoutubeThumbnail = (
  videoId: string,
  quality: 'default' | 'medium' | 'high' | 'maxres' = 'high'
): string => {
  const qualityMap = {
    default: 'default',
    medium: 'mqdefault',
    high: 'hqdefault',
    maxres: 'maxresdefault',
  };
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
};
