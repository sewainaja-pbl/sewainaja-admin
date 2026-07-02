export interface ItemCategoryDoc {
  id: string; // e.g. "001", "002"
  category: string; // e.g. "Elektronik"
  code: string; // e.g. "ELEC"
  photoUrl: string;
  subcategories: string[];
}
