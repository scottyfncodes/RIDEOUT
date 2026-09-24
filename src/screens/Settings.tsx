import { useState } from 'react';
import { HOME_PRESETS } from '../data/regions';
import { DIFFICULTY_LABEL, type DifficultyChoice, type DriveLimit } from '../engine/modes';
import { DEFAULT_PREFS, type Preferences } from '../engine/prefs';
import { cacheClear } from '../services/cache';
import { useStore } from '../state/store';
import { resetSharedData } from '../hooks/useRideData';

export function Settings() {
  const { prefs, setPrefs, setParams } = useStore();
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const up = (p: Partial<Preferences>) => setPrefs({ ...prefs, ...p });

  const useGps = () => {
    if (!navigator.geolocation) {
      setGeoMsg('Location isn’t available in this browser.');
      return;
    }
    setGeoMsg('Locating…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Round to ~1 km: enough for drive times, better for privacy.
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        up({ home: { lat, lon, label: 'My location' } });
        setGeoMsg('Home set to your current location (rounded to ~1 km, stored only on this device).');
      },
      () => setGeoMsg('Couldn’t get your location. Pick a town instead.'),
      { timeout: 10000, maximumAge: 600000 },
    );
  };

  const presetId = prefs.home ? HOME_PRESETS.find((p) => p.lat === prefs.home!.lat && p.lon === prefs.home!.lon)?.id ?? 'custom' : 'denver';

  return (
    <>
      <p className="display brand">RIDEOUT</p>
      <h1 className="display" style={{ fontSize: 40, margin: '6px 0 4px' }}>
        Setup
      </h1>
      <p className="dim">Everything here stays on this device. No account.</p>

      <div className="label">Home</div>
      <div className="field">
        <label htmlFor="home">Starting point for drive times</label>
        <select
          id="home"
          data-testid="home-select"
          value={presetId}
          onChange={(e) => {
            const p = HOME_PRESETS.find((x) => x.id === e.target.value);
            if (p) up({ home: { lat: p.lat, lon: p.lon, label: p.name } });
          }}
        >
          {HOME_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          {presetId === 'custom' && <option value="custom">{prefs.home?.label ?? 'Custom'}</option>}
        </select>
      </div>
      <button type="button" className="btn" onClick={useGps}>
        📍 Use my location
      </button>
      {geoMsg && <p className="dim">{geoMsg}</p>}

      <div className="label">Defaults</div>
      <div className="field">
        <label htmlFor="pd">Preferred difficulty</label>
        <select
          id="pd"
          value={prefs.preferredDifficulty}
          onChange={(e) => {
            const v = e.target.value as DifficultyChoice;
            up({ preferredDifficulty: v });
            setParams({ difficulty: v });
          }}
        >
          <option value="any">Any</option>
          {(['green', 'blue', 'black', 'dblack'] as const).map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="md">Max drive</label>
        <select
          id="md"
          value={String(prefs.maxDrive)}
          onChange={(e) => {
            const v = (e.target.value === 'null' ? null : Number(e.target.value)) as DriveLimit;
            up({ maxDrive: v });
            setParams({ maxDrive: v });
          }}
        >
          <option value="30">30 min</option>
          <option value="60">60 min</option>
          <option value="90">90 min</option>
          <option value="null">Anywhere</option>
        </select>
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="minmi">Min ride (mi)</label>
          <input id="minmi" type="number" inputMode="decimal" min={0} value={prefs.minRideMiles ?? ''} onChange={(e) => up({ minRideMiles: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div className="field">
          <label htmlFor="maxft">Max climbing (ft)</label>
          <input id="maxft" type="number" inputMode="numeric" min={0} step={100} value={prefs.maxClimbFt ?? ''} onChange={(e) => up({ maxClimbFt: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="gear">Gear-up time at trailhead (min)</label>
        <input id="gear" type="number" inputMode="numeric" min={0} max={60} value={prefs.gearUpMin} onChange={(e) => up({ gearUpMin: Math.min(60, Math.max(0, Number(e.target.value) || 0)) })} />
      </div>

      <div className="label">What you like</div>
      {(
        [
          ['likesTechnical', 'Likes technical terrain'],
          ['likesFlow', 'Likes flow'],
          ['dislikesExposure', 'Dislikes exposure'],
          ['wantsScenic', 'Wants scenic rides'],
          ['wantsBrewery', 'Always plan a brewery'],
        ] as Array<[keyof Preferences, string]>
      ).map(([k, label]) => (
        <label key={k} className="toggle">
          <span>{label}</span>
          <input type="checkbox" checked={!!prefs[k]} onChange={(e) => up({ [k]: e.target.checked } as Partial<Preferences>)} />
        </label>
      ))}

      <div className="label">Data</div>
      <div className="btn-row">
        <button
          type="button"
          className="btn"
          onClick={() => {
            cacheClear();
            resetSharedData();
            location.reload();
          }}
        >
          Refresh all data
        </button>
        <button type="button" className="btn" onClick={() => setPrefs({ ...DEFAULT_PREFS })}>
          Reset preferences
        </button>
      </div>
    </>
  );
}
