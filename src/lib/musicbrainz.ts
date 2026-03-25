/** Escape Lucene special characters: + - & | ! ( ) { } [ ] ^ " ~ * ? : \ / */
export function escapeLucene(s: string): string {
  return s.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, "\\$1");
}
