import { Nav } from './components/Nav';
import { useRoute } from './hooks/useRoute';
import { Area } from './screens/Area';
import { BikeEditor } from './screens/BikeEditor';
import { Garage } from './screens/Garage';
import { Home } from './screens/Home';
import { MapScreen } from './screens/MapScreen';
import { Settings } from './screens/Settings';
import { Sources } from './screens/Sources';
import { StoreProvider } from './state/store';

export function App() {
  const route = useRoute();
  return (
    <StoreProvider>
      <div className="app">
        {route.name === 'map' ? (
          <MapScreen />
        ) : (
          <main className="main">
            {route.name === 'home' && <Home />}
            {route.name === 'area' && <Area key={route.id} id={route.id} />}
            {route.name === 'garage' && <Garage />}
            {route.name === 'bike' && <BikeEditor from={route.from} />}
            {route.name === 'settings' && <Settings />}
            {route.name === 'sources' && <Sources />}
          </main>
        )}
        <Nav route={route} />
      </div>
    </StoreProvider>
  );
}
