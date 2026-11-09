async function executeCommand(cmd, sock, m, context) {
  return await cmd.run(
    sock,
    m,
    context
  );
}

module.exports = {
  executeCommand
};
