export type StaffRole='admin'|'menu'|'local';
export const roleNames:Record<StaffRole,string>={admin:'Administrador',menu:'Encargado del menú',local:'Personal del local'};
export const canManageOrders=(role:StaffRole|null)=>role==='admin'||role==='local';
export const canManageMenu=(role:StaffRole|null)=>role==='admin'||role==='menu';
export const canManageUsers=(role:StaffRole|null)=>role==='admin';
