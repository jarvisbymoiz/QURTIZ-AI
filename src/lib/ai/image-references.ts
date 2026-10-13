/** Roles stay with pixels through preparation; adapters encode their own wire format. */
export type ImageReferenceRole = "logo" | "profileAvatar" | "designReference";
export type ImageReference = { mimeType: string; base64: string; role?: ImageReferenceRole };

export function referenceRole(kind: string): ImageReferenceRole {
  return kind === "logo" ? "logo" : kind === "avatar" ? "profileAvatar" : "designReference";
}

export function referenceCounts(references: { role?: ImageReferenceRole }[]) {
  return {
    logo: references.filter(ref => ref.role === "logo").length,
    profileAvatar: references.filter(ref => ref.role === "profileAvatar").length,
    designReferences: references.filter(ref => ref.role === "designReference").length,
    unspecified: references.filter(ref => !ref.role).length,
  };
}
