CREATE MIGRATION m1atlza7vmt26vtrxklo5ybvgkulsh6p5uuwgy3smfe33btqav6jua
    ONTO initial
{
  CREATE EXTENSION pgcrypto VERSION '1.3';
  CREATE EXTENSION auth VERSION '1.0';
  CREATE TYPE default::User {
      CREATE REQUIRED LINK identity: ext::auth::Identity {
          CREATE CONSTRAINT std::exclusive;
      };
  };
};
