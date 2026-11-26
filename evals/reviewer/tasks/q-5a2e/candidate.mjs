export async function inspect(createVisitor, verify) {
  const visitor = await createVisitor();
  try {
    return await verify(visitor);
  } finally {
    await visitor.close();
  }
}
