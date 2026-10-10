import '../core/local_date.dart';
import '../models/training.dart';

/// Assigns a [SessionFocus] to each exercise day of a Season.
///
/// The rotation cycles through a goal-specific sequence, but whenever two
/// exercise days are consecutive it avoids loading the same region hard on
/// both, respecting the ~48 h recovery guideline for a muscle group.
final class FocusRotation {
  const FocusRotation();

  static const _general = [
    SessionFocus.fullBody,
    SessionFocus.upperBody,
    SessionFocus.lowerBody,
    SessionFocus.conditioning,
  ];
  static const _endurance = [
    SessionFocus.conditioning,
    SessionFocus.fullBody,
    SessionFocus.conditioning,
    SessionFocus.coreAndMobility,
  ];
  static const _strength = [
    SessionFocus.lowerBody,
    SessionFocus.upperBody,
    SessionFocus.fullBody,
  ];

  List<SessionFocus> assign(List<LocalDate> days, TrainingGoal goal) {
    final cycle = switch (goal) {
      TrainingGoal.endurance => _endurance,
      TrainingGoal.strength => _strength,
      _ => _general,
    };
    final result = <SessionFocus>[];
    var cursor = 0;
    for (var i = 0; i < days.length; i++) {
      final previous = i == 0 ? null : result[i - 1];
      final consecutive = i > 0 && days[i - 1].daysUntil(days[i]).abs() <= 1;
      var candidate = cycle[cursor % cycle.length];
      cursor++;
      if (consecutive && previous != null && _conflicts(previous, candidate)) {
        candidate = _alternative(previous);
      }
      result.add(candidate);
    }
    return result;
  }

  static bool _conflicts(SessionFocus a, SessionFocus b) =>
      (a.loadsUpper && b.loadsUpper) || (a.loadsLower && b.loadsLower);

  static SessionFocus _alternative(SessionFocus previous) => switch (previous) {
    SessionFocus.upperBody => SessionFocus.lowerBody,
    SessionFocus.lowerBody => SessionFocus.upperBody,
    SessionFocus.fullBody => SessionFocus.coreAndMobility,
    _ => SessionFocus.fullBody,
  };
}
