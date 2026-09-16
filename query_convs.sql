SELECT c.id, c.titre, c.created_at, c.updated_at,
  (SELECT COUNT(*) FROM message m WHERE m.conversation_id = c.id) as msg_count,
  (SELECT json_agg(json_build_object('userId', cp.user_id, 'nom', u.nom, 'prenom', u.prenom, 'type', u.type))
   FROM conversation_participants cp JOIN "user" u ON u.id = cp.user_id
   WHERE cp.conversation_id = c.id) as participants
FROM conversation c ORDER BY c.id
