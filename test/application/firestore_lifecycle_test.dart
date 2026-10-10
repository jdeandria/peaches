import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:peaches/application/app_container.dart';
import 'package:peaches/domain/core/ids.dart';
import 'package:peaches/domain/core/zone_clock.dart';
import 'package:peaches/domain/exercises/exercise_catalog.dart';

import 'lifecycle_suite.dart';

void main() {
  final catalog = ExerciseCatalog.standard();
  runLifecycleSuite(
    'firestore',
    () => AppContainer.firestore(
      FakeFirebaseFirestore(),
      catalog: catalog,
      ids: SequentialIdGenerator(prefix: 'f'),
      zone: const UtcZoneClock(),
    ),
  );
}
