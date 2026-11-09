function createCommandContext({
  m,
  chat,
  isGroup,
  sender,
  pushName,
  args,
  argsTexto,
  text,
  prefix,
  reply,
  permission,
  db,
  commandCount
}) {

  return {
    m,
    chat,
    isGroup,
    sender,
    pushName,
    args,
    argsTexto,
    text,
    prefix,
    reply,
    permission,
    db,
    commandCount
  };

}


module.exports = {
  createCommandContext
};
