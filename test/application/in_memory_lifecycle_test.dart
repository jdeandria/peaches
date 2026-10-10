import 'package:peaches/application/app_container.dart';
import 'package:peaches/domain/core/ids.dart';

import 'lifecycle_suite.dart';

void main() {
  runLifecycleSuite(
    'in-memory',
    () => AppContainer.inMemory(ids: SequentialIdGenerator(prefix: 't')),
  );
}
