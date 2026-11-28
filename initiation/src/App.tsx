import { lessonById } from './content';
import { LessonView } from './components/LessonView';
import { Academie, Fiches, Lexique, Parcours } from './components/Screens';
import { go, useRoute } from './lib/router';

export default function App() {
  const route = useRoute();
  const lesson = route.name === 'lecon' ? lessonById(route.id) : undefined;
  const showNav = route.name !== 'lecon';

  return (
    <>
      <div className="ppc-stripe" aria-hidden="true" />
      <div className="page">
        {route.name === 'academie' && <Academie />}
        {route.name === 'parcours' && <Parcours p={route.p} />}
        {route.name === 'lexique' && <Lexique />}
        {route.name === 'fiches' && <Fiches />}
        {route.name === 'lecon' && (lesson
          ? <LessonView key={lesson.id} lesson={lesson} phase={route.phase} />
          : <div className="card stack"><p>Cette leçon n’existe pas.</p><button className="btn" onClick={() => go({ name: 'academie' })}>← Retour à l’Académie</button></div>)}
      </div>
      {showNav && (
        <nav className="bottom-nav" aria-label="Navigation">
          <div className="inner">
            <button className={route.name === 'academie' || route.name === 'parcours' ? 'on' : ''} onClick={() => go({ name: 'academie' })}><span className="ico">🎓</span>Académie</button>
            <button className={route.name === 'lexique' ? 'on' : ''} onClick={() => go({ name: 'lexique' })}><span className="ico">📖</span>Lexique</button>
            <button className={route.name === 'fiches' ? 'on' : ''} onClick={() => go({ name: 'fiches' })}><span className="ico">📄</span>Mes fiches</button>
          </div>
        </nav>
      )}
    </>
  );
}
