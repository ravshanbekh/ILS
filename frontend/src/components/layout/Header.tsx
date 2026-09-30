import { useEffect, useRef } from 'react';
import Topbar from './Topbar';
import type { TopbarProps } from './Topbar';
import { useTopbarContext } from './topbarContext';

/**
 * Sahifa sarlavhasini global topbar'ga uzatadi.
 *
 * API O'ZGARMAGAN: 42 ta sahifa avvalgidek `<Header title="..." />`
 * chaqiradi. Farqi — endi Header o'zi hech narsa chizmaydi, balki
 * sarlavhani AppLayout'dagi yagona topbar'ga yuboradi (topbarContext.tsx).
 *
 * AppLayout'dan tashqaridagi sahifada (masalan chop etish sahifasi)
 * kontekst bo'lmaydi — u holda topbar avvalgidek shu joyning o'zida
 * chiziladi. Ya'ni hech qaysi sahifa buzilmaydi.
 */
type HeaderProps = Omit<TopbarProps, 'onMenuClick'>;

export default function Header({ title, subtitle, showSearch, searchValue, onSearch }: HeaderProps) {
  const ctx = useTopbarContext();

  // onSearch har renderda yangi funksiya bo'lib keladi. Uni effekt
  // bog'liqligiga qo'ysak, har renderda topbar qayta yangilanib cheksiz
  // aylanishga olib kelardi. Shuning uchun ref orqali barqaror o'ram beramiz.
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const hasSearchHandler = typeof onSearch === 'function';

  useEffect(() => {
    if (!ctx) return;
    ctx.setTopbar({
      title,
      subtitle,
      showSearch,
      searchValue,
      onSearch: hasSearchHandler ? (v: string) => onSearchRef.current?.(v) : undefined,
    });
    // Sahifadan chiqilganda sarlavha keyingi sahifaga "yopishib" qolmasin
    return () => ctx.setTopbar({});
  }, [ctx, title, subtitle, showSearch, searchValue, hasSearchHandler]);

  if (ctx) return null;

  // Kontekstsiz joy — eski xatti-harakat
  return (
    <Topbar
      title={title}
      subtitle={subtitle}
      showSearch={showSearch}
      searchValue={searchValue}
      onSearch={onSearch}
    />
  );
}
