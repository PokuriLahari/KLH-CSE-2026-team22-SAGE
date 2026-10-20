package auth_service.repository;

import auth_service.model.DeletedAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface DeletedAccountRepository extends JpaRepository<DeletedAccount, Long> {
    Optional<DeletedAccount> findByGoogleId(String googleId);
    Optional<DeletedAccount> findByEmailIgnoreCase(String email);
    boolean existsByGoogleId(String googleId);
    boolean existsByEmailIgnoreCase(String email);
}
