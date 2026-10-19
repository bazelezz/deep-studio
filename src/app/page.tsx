import SceneExperience from '@/components/SceneExperience';
import DisplaySite from '@/components/DisplaySite';
import ScrollShowcase from '@/components/ScrollShowcase';
import MotionStudy from '@/components/MotionStudy';
import FilmEnd from '@/components/FilmEnd';
import FilmDirector from '@/components/FilmDirector';

export default function Home() {
  return <>
    <a className="skip-link" href="#main">Перейти к содержанию</a>
    <div id="top" className="hero-world">
      <main id="main">
        <SceneExperience><DisplaySite /></SceneExperience>
        <FilmDirector />
        <ScrollShowcase />
        <MotionStudy />
      </main>
      <FilmEnd />
    </div>
  </>;
}
