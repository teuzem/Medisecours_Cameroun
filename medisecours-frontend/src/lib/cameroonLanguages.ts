export type CameroonLanguage = {
  id: string
  code: string
  name: string
  french: string
  classification: string
}

/**
 * Controlled Cameroon language catalogue.
 *
 * The 250 entries are the ALCAM (2012) inventory reproduced in the
 * "Languages of Cameroon" reference article. The numeric ALCAM code is used
 * as a stable local identifier because it is the identifier supplied by the
 * source (it is not an ISO 639 code).
 */
const RAW_CAMEROON_LANGUAGE_DATA = `
001|Fulfulde|Fulfulde|Senegambian
002|Kanuri|Kanuri|Saharan
003|Sara|Sara|Central Sudanic
004|Pidgin English|Pidgin-English|creole
005|Arabic|Arabe|Semitic
101|Hausa|Hausa|West Chadic
102|Gedar|Gédar|Central Chadic
103|Munjuk|Munjuk|Central Chadic
104|Yedina|Yedina|Central Chadic
105|Kera|Kera|East Chadic
111|Wandala|Wandala|Central Chadic
112|Gelvaldaxa|Gélvaldaxa|Central Chadic
113|Parekwa|Parékwa|Central Chadic
121|Gevoko|Gévoko|Central Chadic
122|Hdi|Hdi|Central Chadic
123|Mabas|Mabas|Central Chadic
131|Pelasla|Pélasla|Central Chadic
132|Mbuko|Mbuko|Central Chadic
140|Matal|Matal|Central Chadic
151|Wuzlam|Wuzlam|Central Chadic
152|Muyang|Muyang|Central Chadic
153|Mada|Mada|Central Chadic
154|Melokwo|Mélokwo|Central Chadic
161|Zelgwa Minew|Zélgwa Minew|Central Chadic
162|Dugwor|Dugwor|Central Chadic
163|Merey|Merey|Central Chadic
164|Gemzek|Gemzek|Central Chadic
171|Giziga|Giziga|Central Chadic
173|Mofu-Duvangar|Mofu-Duvangar|Mofou-Nord
174|Mofu-Gudur|Mofu-Gudur|Mofou-Sud
175|Baldamu|Baldamu|Central Chadic
181|Cuvok|Cuvok|Central Chadic
182|Mefele|Mefele|Central Chadic
183|Mafa|Mafa|Central Chadic
191|Psikya|Psikyá|Central Chadic
192|Hya|Hya|Central Chadic
193|Bana|Bana|Central Chadic
211|Jimjimen|Jimjimén|Central Chadic
212|Gude|Gude|Central Chadic
213|Ziziliveken|Zizilivékén|Central Chadic
214|Sharwa|Sharwa|Central Chadic
215|Tsuvan|Tsuvan|Central Chadic
220|Njanyi|Njanyi|Central Chadic
230|Gbwata|Gbwata|Central Chadic
240|Buwal–Gavar|Buwal–Gavar|Central Chadic
251|Besleri|Besleri|Central Chadic
252|Daba|Daba|Central Chadic
253|Mazagway Hide|Mazagway Hide|Central Chadic
254|Mbedam|Mbédam|Central Chadic
261|Jina|Jina|Central Chadic
262|Majera|Majéra|Central Chadic
271|Lagwan|Lagwan|Central Chadic
272|Mser|Msér|Central Chadic
281|Afade|Afadé|Central Chadic
282|Maslam|Maslam|Central Chadic
283|Malgbe|Malgbe|Central Chadic
284|Mpade|Mpadé|Central Chadic
291|Masa|Masa|Masa
292|Zumaya|Zumaya|Masa
293|Musey|Musey|Masa
294|Zime|Zime|Masa
300|Samba|Samba|Samba
301|Longto|Lóñtó|Vere-Duru
302|Paare|Pááre|Páárá
303|Doayo|Doayo|Doyayo
304|Tupuri|Tupuri|Mbum
305|Mundang|Mundañ|Mbum
306|Mambay|Mambay|Mbum
307|Dama|Dama|Mbum
308|Mono|Mono|Mbum
309|Baka|Baka|Ubangian
311|Kobo|Kobo|Vere-Duru
312|Koma Ndera|Koma Ndera|Vere-Duru
321|Gimnime|Gímníme|Vere-Duru
322|Kompana|Kompana|Vere-Duru
330|Duupa|Duupa|Vere-Duru
341|Dugun|Dugun|Vere-Duru
342|Dii|Dii|Vere-Duru
343|Kolbila|Kolbila|Vere-Duru
351|Mbum|Mbum|Mbum
352|Karang|Karang|Mbum
353|Pana|Pana|Mbum
354|Kali-Dek|Kali-Dek|Mbum
355|Kuo|Kuo|Mbum
356|Gbata|Gbátá|Mbum
361|Pam|Pam|Mbum
362|Ndai|Ndai|Mbum
371|Fali, Northern|Fali-Nord|Fali
372|Fali, Southern|Fali-Sud|Fali
381|Gbaya|Gbaya|Ubangian
382|Bangandu|Bangandu|Bangando
391|Gey|Gey|Adamawa
392|Duli|Duli|Adamawa
393|Nimbari|Nimbari|Adamawa
394|Oblo|Oblo|Adamawa
395|Mome|Mome|Adamawa
401|Basaa|Basaa|Bantu
402|Bakoko|Bakoko|Bantu
403|Beti–Fang|Béti–Fañ|Bantu
404|Bembele|Bémbélé|Bantu
405|Bebil|Bébil|Bantu
406|Bankon|Bankon|Barombi
411|Meka|Méka|Mékaa
412|So|Só|Só'
413|Bikele|Bikele|Bantu
421|Kwasio|Kwasio|Bantu
422|Bagyali|Bagyáli|Bagyeli
431|Mpo|Mpo|Bantu
432|Koozime|Kóózime|Bantu
440|Kako|Kakó|Bantu
462|Polri|Polri|Bantu
463|Kwakum|Kwakum|Bantu
501|Tikari|Tikari|Tikar
502|Ndemli|Ndemli|Bantu
511|Tunan|Tunán|Bantu
512|Nomande|Nomande|Nómaande
513|Atomp|Atómp|Bantu
514|Ninyo'o|Ninyó'ó|Bantu
520|Nigi|Nigi|Bantu
530|Bati|Bati|Bantu
541|Nugunu|Nugunu|Bantu
542|Nuasua|Nuasuá|Nuaswá
543|Nubaca|Nubaca|Bantu
544|Dumbula|Dumbulá|Bantu
550|Tuki|Tuki|Bantu
570|Tebaya|Tébáya|Bantu
581|Lefa'|Léfa'|Bantu
582|Dembong|Démbóñ|Dimbóñ
583|Ripay|Rípáy|Bantu
584|Rikpa|Ríkpa'|Bantu
601|Yasa|Yasa|Bantu
602|Batanga|Batanga|Bantu
610|Duala|Duala|Bantu
621|Mokpwe|Mokpwe|Bantu
622|Wumboko|Wumboko|Bantu
623|Bubia|Bubia|Bantu
624|Isu|Isu|Bantu
625|Bakola|Bakólá|Bantu
630|Oroko|Oroko|Bantu
640|Lifo-Balong|Lifó-Baloñ|Bantu
651|Mbo|Mbo|Bantu
652|Akoosa|Akóósá|Bantu
653|Nsosa|Nsósá|Bantu
701|Njukun|Njukun|Jukunoid
702|Kutep|Kutep|Jukunoid
703|Uuhum-Gigi|Uuhum-Gigi|Yukubenic
704|Korop|Korop|Cross River
705|Efik|Efik|Cross River
706|Boki|Boki|Bendi
707|Akum|Akum|Cross River
708|Baazen Nsaa|Báázen Nsaa|Báázán Nsaa
709|Mbembe|Mbembe|Cross River
710|Mambila|Mambila|Mambiloid
720|Vute|Vúte|Mambiloid
730|Nizaa|Nizåå|Mambiloid
741|Kwanja|Kwanja|Mambiloid
742|Bung|Buñ|Mambiloid
743|Kamkam|Kamkam|Mambiloid
750|Njoyama|Njóyamá|Njoyame
760|Twendi|Twendi|Mambiloid
780|Njanga|Njanga|Mambiloid
791|Yeni|Yeni|Mambiloid
792|Kasabe|Kasabe|Mambiloid
793|Luo|Luo|Mambiloid
801|Njwanda|Njwandá|Njwande
802|Tiv|Tiv|Tivoid
803|Esimbi|Esimbi|Tivoid
804|Amasi|Amasi|Manta
805|Njen|Njen|Momo
806|Mbonga|Mbóña|Jarawan
807|Ngong-Nagumi|Ngoñ-Nagumi|Jarawan
808|Ejagham|Ejagham|Jarawan
810|Aghem|Aghem|Ekoid
821|Mman|Mmán|Ring
822|Itangikom|Itangikom|Kom
823|Bum|Bum|Ring
824|Babanki|Babanki|Ring
825|Ebkuo|Ebkuo|Ébkuó
830|Lamnso'|Lamnsó'|Ring
841|Kenswei Nsei|Kénswei Nsei|Ring
842|Niemeng|Niemeng|Ring
843|Vengo|Véño|Ring
844|Wushi|Wushi|Ring
851|Befang|Befang|Menchum
852|Modele|Modele|Menchum
861|Ngwo|Ngwó|Momo
862|Basa|Basa|Momo
863|Konda|Konda|Momo
864|Widikum|Widikum|Momo
865|Menka|Menka|Momo
866|Ambele|Ambele|Momo
867|Mundani|Mundani|Momo
868|Ngamambo|Ngamambo|Momo
869|Busam|Busam|Momo
871|Bebe|Bebe|East Beboid
872|Kemezung|Kémézuñ|East Beboid
873|Ncane|Ncane|East Beboid
874|Nsari|Nsari|East Beboid
875|Noone|Nóóné|East Beboid
876|Naki|Naki|West Beboid
877|Bu|Bu|West Beboid
878|Missong|Missong|West Beboid
879|Koshin|Koshin|West Beboid
881|Kenyang|Kenyang|Nyang
882|Denya|Denya|Nyang
883|Kendem|Kendem|Nyang
885|Mungong|Muñgóñ|West Beboid
886|Cung|Cuñ|West Beboid
887|Busuu|Busuu|West Beboid
888|Bishuo|Bishuó|West Beboid
889|Bikya|Bikya|West Beboid
891|Ugare|Ugaré|Tivoid
892|Batomo|Batomo|Tivoid
893|Caka|Caka|Tivoid
894|Iyive|Iyive|Tivoid
895|Iceve|Iceve|Tivoid
896|Evand|Evand|Tivoid
897|Asumbo|Asumbo|Tivoid
898|Eman|Eman|Tivoid
899|Ihatum|Ihatum|Tivoid
901|Kwa'|Kwa'|Kwa
902|Mengambo|Méñgambo|Eastern Grassfields
903|Limbum|Limbum|Eastern Grassfields
904|Dzodinka|Dzodinka|Eastern Grassfields
905|Nda'nda'|Nda'nda'|Eastern Grassfields
906|Yamba|Yamba|Eastern Grassfields
907|Mbe'|Mbé'|Eastern Grassfields
911|Mundum|Mundum|Eastern Grassfields
912|Bafut|Bafut|Eastern Grassfields
913|Mankon|Mankon|Eastern Grassfields
914|Bambili|Bambili|Eastern Grassfields
915|Nkwan-Mendankwe|Nkwán-Mendankwe|Nkwen-Mendankwe
916|Pinyin|Pinyin|Eastern Grassfields
917|Awing|Awing|Eastern Grassfields
920|Ngombale|Ngombale|Eastern Grassfields
930|Megaka|Mégaka|Eastern Grassfields
940|Ngomba|Ngomba|Eastern Grassfields
951|Ngyamboong|Ngyámbóóñ|Eastern Grassfields
952|Yemba|Yemba|Eastern Grassfields
953|Ngwe|Ñwe|Eastern Grassfields
960|Ghomala'|Ghómala'|Eastern Grassfields
970|Fe'fe'|Fe'fe'|Eastern Grassfields
980|Mfumte|Mfumte|Eastern Grassfields
991|Shüpamom|Shüpamom|Shü Pamém
992|Bangolan|Bangolan|Eastern Grassfields
993|Mboyakum|Mboyakum|Cirambo
994|Ngoobechop|Ngoobechop|Bamali
995|Chuufi|Chuufi|Bafanji
996|Mungaka|Mungaka|Eastern Grassfields
997|Medumba|Médúmba|Eastern Grassfields
`

export const CAMEROON_LANGUAGE_SOURCE = {
  title: 'Atlas linguistique du Cameroun (ALCAM), 2012',
  reference: 'Languages of Cameroon, ALCAM (2012) table',
  license: 'Wikipedia content under CC BY-SA 4.0; ALCAM bibliographic source',
  count: 250,
} as const

export const CAMEROON_LANGUAGES: CameroonLanguage[] = RAW_CAMEROON_LANGUAGE_DATA
  .trim()
  .split('\n')
  .map((line) => {
    const [code, name, french, classification] = line.split('|')
    return {
      id: `alcam_${code}`,
      code,
      name,
      french,
      classification,
    }
  })

export function normalizeLanguageSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
}

export function findCameroonLanguage(value: string): CameroonLanguage | undefined {
  const normalized = normalizeLanguageSearch(value)
  return CAMEROON_LANGUAGES.find(
    (language) =>
      language.id === value ||
      language.code === value ||
      normalizeLanguageSearch(language.name) === normalized ||
      normalizeLanguageSearch(language.french) === normalized,
  )
}
