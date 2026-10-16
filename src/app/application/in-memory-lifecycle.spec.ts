import { runLifecycleSuite } from '../../testing/lifecycle-suite';
import { SequentialIdGenerator } from '../domain/core/ids';
import { UtcZoneClock } from '../domain/core/zone-clock';
import { ExerciseCatalog } from '../domain/exercises/exercise-catalog';
import { inMemoryRepositories } from '../data/in-memory/in-memory-repositories';
import { AppContainer } from './app-container';

runLifecycleSuite(
  'in-memory',
  () =>
    new AppContainer(
      inMemoryRepositories(),
      ExerciseCatalog.standard(),
      new SequentialIdGenerator('t'),
      new UtcZoneClock(),
    ),
);
