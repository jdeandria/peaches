import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'support/test_app.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Peaches core journey on a real engine', (tester) async {
    await pumpSeededApp(tester);
    await runCoreJourney(tester);
  });
}
