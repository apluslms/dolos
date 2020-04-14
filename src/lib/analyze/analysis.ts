import { Intersection } from "./intersection";
import { DefaultMap } from "../util/defaultMap";
import { File } from "../file/file";
import { TokenizedFile } from "../file/tokenizedFile";
import { Match, Side } from "./match";
import { Selection } from "../util/selection";
import { Range } from "../util/range";
import { Options } from "../util/options";

export interface ScoredIntersection {
  intersection: Intersection;
  overlap: number;
  longest: number;
  similarity: number;
}

export interface FilePart {
  file: TokenizedFile;
  side: Side<Selection>;
}

export class Analysis {

  // to keep track of which two files match (and not have two times the same
  // Intersection but in different order), we use a nested map where we use
  // the two keys in lexicographical order
  private intersectionMap:
    DefaultMap<TokenizedFile, Map<TokenizedFile, Intersection>>
    = new DefaultMap(() => new Map())

  // computed list of scored intersections,
  // only defined after finished() is called
  private scored?: Array<ScoredIntersection>;

  constructor(
    public readonly options: Options
  ) {}

  public addMatch(
    left: FilePart,
    right: FilePart,
    hash: number,
  ): void {

    const [first, second] = [left.file, right.file].sort(File.compare);
    let intersection = this.intersectionMap.get(first).get(second);
    if (!intersection) {
      intersection = new Intersection(left.file, right.file);
      this.intersectionMap.get(first).set(second, intersection);
    }

    const match = new Match(left.side, right.side, hash);
    intersection.addMatch(match);
  }

  /**
   * Finish the analysis and apply postprocessing steps.
   */
  public finish(): void {
    for(const intersection of this.intersectionIterator()) {
      intersection.removeSmallerThan(this.options.minFragmentLength),
      intersection.squash();
    }
    this.scored = this.intersections()
      .filter(i => i.fragments.length > 0)    // ignore empty intersections
      .map(i => this.calculateScore(i))       // calculate their similarity
      .filter(s =>                            // hashing by minimum similarity
        s.similarity >= this.options.minSimilarity
      )
      .sort((a, b) => b.overlap - a.overlap) // sort in reversed order
      .slice(0, this.options.limitResults);  // limit to first n results
    Object.freeze(this);
  }

  public *intersectionIterator(): IterableIterator<Intersection> {
    for (const map of this.intersectionMap.values()) {
      yield *map.values();
    }
  }

  public intersections(): Array<Intersection> {
    return Array.of(...this.intersectionIterator());
  }

  public scoredIntersections(): Array<ScoredIntersection> {
    if(this.scored) {
      return this.scored;
    } else {
      throw new Error("This analysis is not finished yet, " +
                      "but scoredIntersections() was called");
    }
  }

  private calculateScore(intersection: Intersection): ScoredIntersection {
    const leftCovered =
      Range.totalCovered(intersection.fragments.map(f => f.leftKmers));
    const rightCovered =
      Range.totalCovered(intersection.fragments.map(f => f.rightKmers));
    const leftTotal = intersection.leftFile.kmers.length;
    const rightTotal = intersection.rightFile.kmers.length;
    return {
      intersection,
      overlap: leftCovered,
      longest: intersection.largestFragmentLength(),
      similarity: (leftCovered + rightCovered) / (leftTotal + rightTotal)
    };
  }
}