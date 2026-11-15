const neutral='M 4 61 C 4 25 23 15 45 15 C 67 15 86 25 86 61 L 86 84 C 86 120 67 130 45 130 C 23 130 4 120 4 84 Z';
const happy='M 2 90 C 3 43 24 25 45 25 C 67 25 87 43 88 90 C 88 100 76 103 73 91 C 65 60 57 50 45 50 C 32 50 24 60 17 91 C 14 103 1 100 2 90 Z';
export function eyePaths(mood){
 if(['happy','playful'].includes(mood))return [happy,happy];
 if(mood==='curious')return [neutral,'M 1 50 C 1 15 20 8 45 8 C 70 8 90 15 90 50 L 90 95 C 90 132 70 139 45 139 C 20 139 1 132 1 95 Z'];
 if(mood==='sad')return ['M 4 55 C 26 50 60 32 86 25 L 86 84 C 86 120 67 130 45 130 C 23 130 4 120 4 84 Z','M 4 25 C 26 32 60 50 86 55 L 86 84 C 86 120 67 130 45 130 C 23 130 4 120 4 84 Z'];
 if(mood==='focused')return ['M 4 28 L 86 58 L 86 84 C 86 112 67 122 45 122 C 23 122 4 112 4 84 Z','M 4 58 L 86 28 L 86 84 C 86 112 67 122 45 122 C 23 122 4 112 4 84 Z'];
 return [neutral,neutral];
}
