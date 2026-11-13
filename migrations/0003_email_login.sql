-- Connexion par email (lien magique) : un lien à usage unique, valable quelques minutes. Le jeton lui-même n'est jamais
-- stocké (son SHA-256 seulement) ; l'adresse sert à retrouver le compte (users.id = 'mail:' + empreinte de l'adresse).

CREATE TABLE email_logins (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,            -- pseudo choisi (posé à la création du compte ; l'adresse n'est jamais affichée)
  expires_at INTEGER NOT NULL
);
CREATE INDEX email_logins_email ON email_logins(email);
