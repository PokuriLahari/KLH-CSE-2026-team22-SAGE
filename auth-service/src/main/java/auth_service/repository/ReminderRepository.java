package auth_service.repository;

import auth_service.model.Reminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReminderRepository extends JpaRepository<Reminder, Long> {

    List<Reminder> findByUserIdOrderByDueAtAsc(Long userId);

    Optional<Reminder> findByIdAndUserId(Long id, Long userId);

    List<Reminder> findByUserIdAndTargetTypeAndContestId(Long userId, String targetType, String contestId);

    List<Reminder> findByUserIdAndTargetTypeAndTargetId(Long userId, String targetType, String targetId);

    List<Reminder> findByStatusAndDeliveryStatusAndDueAtLessThanEqual(String status, String deliveryStatus, Instant dueAt);

    List<Reminder> findByStatusInAndDeliveryStatusAndDueAtLessThanEqual(List<String> statuses, String deliveryStatus, Instant dueAt);

    @org.springframework.transaction.annotation.Transactional
    void deleteByUserId(Long userId);
}
