export type HairStyle = 'short' | 'bob' | 'twin' | 'messy' | 'pony' | 'neat' | 'helmet' | 'beanie';
export type Accessory =
  | 'muffler' | 'wrench' | 'beard' | 'pouch' | 'goggles' | 'sprout' | 'headphones'
  | 'glasses' | 'robot' | 'gloves' | 'vest' | 'armband' | 'bag' | 'tea';

/** 오리지널 도트 캐릭터의 외형 파라미터 (스프라이트는 art/sprites.ts에서 절차적으로 그린다) */
export interface Look {
  skin: string;
  hair: string;
  hairDark: string;
  outfit: string;
  outfitDark: string;
  pants: string;
  shoes: string;
  style: HairStyle;
  acc: Accessory[];
  accent: string;
  hat?: string;
}

const SHOES = '#1E2233';

export const PLAYER_LOOKS: Look[] = [
  { skin: '#F2C9A5', hair: '#5B3A29', hairDark: '#3E2719', outfit: '#547E9D', outfitDark: '#3D5E78', pants: '#2E3550', shoes: SHOES, style: 'short', acc: ['armband'], accent: '#FFD47B' },
  { skin: '#EFC6A3', hair: '#2A2A3A', hairDark: '#1A1A26', outfit: '#4FA39A', outfitDark: '#3A8179', pants: '#2E3550', shoes: SHOES, style: 'pony', acc: ['armband'], accent: '#FFD47B' },
  { skin: '#E6B892', hair: '#A8643A', hairDark: '#7E4826', outfit: '#C77B5A', outfitDark: '#A35F42', pants: '#33385A', shoes: SHOES, style: 'bob', acc: ['armband'], accent: '#FFD47B' },
];

export const NPC_LOOKS = {
  harin: { skin: '#F5CFAE', hair: '#4A2C22', hairDark: '#311C15', outfit: '#F6C744', outfitDark: '#D9A72A', pants: '#3B4466', shoes: SHOES, style: 'twin', acc: ['muffler'], accent: '#E0503F' },
  taeo: { skin: '#E8B994', hair: '#A3A3AE', hairDark: '#7C7C88', outfit: '#E58A3A', outfitDark: '#B96A27', pants: '#5A4636', shoes: SHOES, style: 'neat', acc: ['beard', 'wrench'], accent: '#AEB6C8' },
  seojin: { skin: '#F3CBA8', hair: '#1F1F2B', hairDark: '#12121A', outfit: '#9BCB5A', outfitDark: '#79A83E', pants: '#38415E', shoes: SHOES, style: 'bob', acc: ['pouch'], accent: '#5E7F3A' },
  woojoo: { skin: '#EBC09B', hair: '#6B4128', hairDark: '#4C2C1A', outfit: '#B88A5A', outfitDark: '#94693F', pants: '#4C5B3A', shoes: SHOES, style: 'beanie', acc: ['sprout', 'goggles', 'tea'], accent: '#6FBF5A', hat: '#4F8A45' },
  dodam: { skin: '#F1C6A2', hair: '#3A2A4A', hairDark: '#261A33', outfit: '#8E6CC0', outfitDark: '#6E4FA0', pants: '#2E3550', shoes: SHOES, style: 'bob', acc: ['headphones', 'glasses', 'bag'], accent: '#4A3A6A' },
  jio: { skin: '#EDC4A0', hair: '#96D9BC', hairDark: '#6BB79A', outfit: '#6A7FA8', outfitDark: '#4F6189', pants: '#2C3148', shoes: SHOES, style: 'messy', acc: ['gloves', 'robot'], accent: '#96D9BC' },
  dam: { skin: '#EFC39E', hair: '#232330', hairDark: '#15151F', outfit: '#2D4176', outfitDark: '#1F2E58', pants: '#1F2E58', shoes: SHOES, style: 'neat', acc: ['goggles'], accent: '#FFD47B' },
  boram: { skin: '#E9BE98', hair: '#3B2B22', hairDark: '#261B15', outfit: '#C9E05A', outfitDark: '#A5BC3D', pants: '#3C3F55', shoes: SHOES, style: 'helmet', acc: ['vest'], accent: '#F48B70', hat: '#FFD447' },
} satisfies Record<string, Look>;

const CITIZEN_PALETTE: [string, string, string][] = [
  ['#7A8CA8', '#5E6F8A', '#4B3A2E'],
  ['#A8806A', '#8A6552', '#2B2B38'],
  ['#6F9C8A', '#55806F', '#6B4A36'],
  ['#9C7AA8', '#7E5E8A', '#3A2A2A'],
  ['#B0A070', '#8E8055', '#24242E'],
  ['#8892A0', '#6C7584', '#5A3A2A'],
];
const CITIZEN_STYLES: Look['style'][] = ['short', 'bob', 'messy', 'pony', 'neat', 'twin'];

export function citizenLook(i: number): Look {
  const [o, od, h] = CITIZEN_PALETTE[i % CITIZEN_PALETTE.length];
  return {
    skin: i % 3 === 0 ? '#E3B48E' : i % 3 === 1 ? '#F0C9A6' : '#C99A76',
    hair: h,
    hairDark: '#1C1A22',
    outfit: o,
    outfitDark: od,
    pants: '#2F3448',
    shoes: SHOES,
    style: CITIZEN_STYLES[i % CITIZEN_STYLES.length],
    acc: i % 4 === 0 ? ['muffler'] : [],
    accent: '#7C7F8E',
  };
}
