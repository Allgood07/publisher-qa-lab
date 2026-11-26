export async function inspect(createVisitor, verify) {
  const visitor = await createVisitor();
  const result = await verify(visitor);
  await visitor.close();
  return result;
}
