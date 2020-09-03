import { Injectable, Inject } from '@nestjs/common';
import { Manga } from '../entities/manga.entity';

import { MangaRepository } from '../manga.repository';

import { Base64 } from 'js-base64';

import { MANGA_REPOSITORY_TOKEN } from '../../../common/config/databaseTokens.constants';
import { Chapter } from '../entities/chapter.entity';
import { CreateMangaDto } from '../dto/createManga.dto';
import { ChaptersService } from './chapters.service';
import {
  MangaNotFoundException,
  MangaAlreadyExistsException,
  ChapterNotFoundException,
} from '../../../common/exceptions';
import { env } from 'src/env';
import * as fs from 'fs';
import { getFileExtension } from 'src/common/utils';

@Injectable()
export class MangaService {
  constructor(
    @Inject(MANGA_REPOSITORY_TOKEN)
    private readonly mangaRepository: MangaRepository,
    private readonly chaptersService: ChaptersService,
  ) {}

  getMangas(): Promise<Manga[]> {
    return this.mangaRepository.getMangas();
  }

  public async getManga(id: number): Promise<Manga> {
    const manga = await this.mangaRepository.getMangaById(id);

    if (!manga) {
      throw new MangaNotFoundException();
    }

    return manga;
  }

  public async getMangaWithChapters(id: number): Promise<Manga> {
    const manga = await this.mangaRepository.getMangaWithChapters(id);

    if (!manga) {
      throw new MangaNotFoundException();
    }

    return manga;
  }

  public async getChapter(id: number, chapterNo: number): Promise<Chapter> {
    const chapter = await this.mangaRepository.getChapter(id, chapterNo);

    if (!chapter) {
      throw new ChapterNotFoundException();
      // TODO not working, give it a look
    }

    return chapter;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public async createManga(
    createMangaDto: CreateMangaDto,
    file: any,
  ): Promise<Manga> {
    const manga = await this.mangaRepository.getMangaByName(
      createMangaDto.name,
    );

    if (manga) {
      throw new MangaAlreadyExistsException();
    }

    const extension = getFileExtension(file.filename);

    const encodedFileName = `${Base64.encode(
      file.filename + new Date().getTime(),
    )}.${extension}`;

    const coverPath = file.path.replace(file.filename, encodedFileName);
    fs.renameSync(file.path, coverPath);

    const coverWebPath = `/manga_covers/${encodedFileName}`;

    return this.mangaRepository.saveManga({
      ...createMangaDto,
      coverPath,
      coverWebPath,
    });
  }

  async deleteManga(id: number) {
    const {
      chapters,
      ...manga
    } = await this.mangaRepository.getMangaWithChapters(id);

    if (!manga) {
      throw new MangaNotFoundException();
    }

    if (chapters) {
      chapters.forEach(chapter =>
        this.chaptersService.deleteChapterFiles(chapter),
      );
    }

    fs.unlinkSync(manga.coverPath);

    return this.mangaRepository.delete(manga);
  }
}
