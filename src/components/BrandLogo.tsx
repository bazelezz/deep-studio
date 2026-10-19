import { siteConfig } from '@/config/site';
import artwork from '@/config/brandArtwork.json';
import styles from './BrandLogo.module.css';

/** Offset open planes frame a passage; the wordmark is a secondary signature. */
export default function BrandLogo() {
  return <span className={styles.logo} data-brand-logo>
    {siteConfig.brand === artwork.name ? (
      <svg className={styles.artwork} width={artwork.width} height={artwork.height} viewBox={`0 0 ${artwork.width} ${artwork.height}`} fill="currentColor" aria-hidden="true" focusable="false">
        <g data-logo-symbol>{artwork.symbol.paths.map((path, index) => <path key={index} d={path} />)}</g>
        <g transform={artwork.wordmarkTransform}>{artwork.paths.map((path, index) => <path key={index} fillRule="evenodd" d={path} />)}</g>
      </svg>
    ) : <span className={styles.name}>{siteConfig.brand}</span>}
  </span>;
}
