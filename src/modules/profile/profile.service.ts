import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import {
  AgifyResponse,
  GenderizeResponse,
  NationalizeResponse,
  RestCountriesData,
} from 'src/utils/type';
import { AgeGroup, Gender, Prisma, Profile } from '~gen/prisma/client';
import {
  PaginationResponse,
  DataWithMessage,
} from 'src/utils/response.interceptors';
import {
  GetProfileDto,
  ProfileOrderBy,
  ProfileSortBy,
} from './dto/get-profile.dto';
import { SearchProfileDto } from './dto/search-profile.dto';
import { PrismaService } from 'src/prisma/prisma.service';

// REGEX
// find country name: (?<=from )\w+
// find age group: (child|teenager|adult|senior)
// find min_age: (?<=below )\d+
// find max_age: (?<=above )\d+
// find gender: (male|female)

@Injectable()
export class ProfileService {
  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}
  async create(createProfileDto: CreateProfileDto) {
    const { name } = createProfileDto;
    const existing = await this.profile({ name });
    if (existing) {
      return new DataWithMessage(existing, 'Profile already exists');
    }
    const enrichData = await Promise.all([
      this.genderize(name),
      this.agify(name),
      this.nationalize(name),
    ]).catch((e) => {
      console.log(e);
      if (e instanceof HttpException) {
        throw new BadGatewayException(e.message);
      }
      throw new InternalServerErrorException();
    });
    // const enrichData = testData;
    const { gender, probability: gender_probability } = enrichData[0];
    const { age } = enrichData[1];
    const { country_id, probability: country_probability } =
      enrichData[2].country[0];
    const rounded_country_probability = Math.round(country_probability * 100) / 100;
    const country_name = await this.getCountryName(country_id);
    return this.createProfile({
      name,
      gender: gender!,
      gender_probability,
      age,
      age_group: this.getAgeGroup(age),
      country_id,
      country_name,
      country_probability: rounded_country_probability,
    });
  }

  async findAll(getProfileDto: GetProfileDto, baseUrl: string) {
    let order: Prisma.SortOrder | undefined = undefined;
    if (getProfileDto.order == ProfileOrderBy.asc) order = 'asc';
    else if (getProfileDto.order == ProfileOrderBy.desc) order = 'desc';
    const page = getProfileDto.page ?? 1;
    const limit = getProfileDto.limit ?? 10;
    const where: Prisma.ProfileWhereInput = {
      gender: getProfileDto.gender,
      age_group: getProfileDto.age_group,
      country_id: getProfileDto.country_id,
      age: {
        gte: getProfileDto.min_age,
        lte: getProfileDto.max_age,
      },
      gender_probability: {
        gte: getProfileDto.min_gender_probability,
      },
      country_probability: {
        gte: getProfileDto.min_country_probability,
      },
    };
    const [data, total] = await Promise.all([
      this.prisma.client.profile.findMany({
        where,
        orderBy: {
          ...(getProfileDto.sort_by == ProfileSortBy.age && { age: order }),
          ...(getProfileDto.sort_by == ProfileSortBy.created_at && {
            created_at: order,
          }),
          ...(getProfileDto.sort_by == ProfileSortBy.gender_probability && {
            gender_probability: order,
          }),
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.profile.count({ where }),
    ]);
    const total_pages = Math.ceil(total / limit);
    const url = new URL(baseUrl, process.env.API_BASE_URL);
    const buildUrl = (p: number) => {
      url.searchParams.set('page', String(p));
      return `${url.pathname}${url.search}`;
    };
    const links = {
      self: buildUrl(page),
      next: page < total_pages ? buildUrl(page + 1) : null,
      prev: page > 1 ? buildUrl(page - 1) : null,
    };
    return new PaginationResponse(data, page, limit, total, total_pages, links);
  }

  async findAllForExport(getProfileDto: GetProfileDto): Promise<Profile[]> {
    let order: Prisma.SortOrder | undefined = undefined;
    if (getProfileDto.order == ProfileOrderBy.asc) order = 'asc';
    else if (getProfileDto.order == ProfileOrderBy.desc) order = 'desc';
    const where: Prisma.ProfileWhereInput = {
      gender: getProfileDto.gender,
      age_group: getProfileDto.age_group,
      country_id: getProfileDto.country_id,
      age: {
        gte: getProfileDto.min_age,
        lte: getProfileDto.max_age,
      },
      gender_probability: { gte: getProfileDto.min_gender_probability },
      country_probability: { gte: getProfileDto.min_country_probability },
    };
    return this.prisma.client.profile.findMany({
      where,
      orderBy: {
        ...(getProfileDto.sort_by == ProfileSortBy.age && { age: order }),
        ...(getProfileDto.sort_by == ProfileSortBy.created_at && {
          created_at: order,
        }),
        ...(getProfileDto.sort_by == ProfileSortBy.gender_probability && {
          gender_probability: order,
        }),
      },
    });
  }

  async findOne(id: string) {
    const profile = await this.profile({ id });
    if (!profile) throw new BadRequestException('Profile does not exist');
    return profile;
  }

  async search(searchProfileDto: SearchProfileDto, baseUrl: string) {
    const result = this.parseQuery(searchProfileDto.q);
    const bool = Object.values(result).every((v) => !v);
    if (bool) {
      throw new BadRequestException('Unable to interpret query');
    }
    const { country, ageGroup, minAge, maxAge, gender, isYoung } = result;
    let country_id: string | undefined = undefined;
    if (country) {
      country_id = await this.getCountryId(country).catch(() => {
        throw new BadRequestException('Unable to interpret query');
      });
    }
    const getProfileDto: GetProfileDto = {
      country_id: country_id,
      age_group: ageGroup as AgeGroup | undefined,
      min_age: isYoung ? 16 : minAge ? +minAge : undefined,
      max_age: isYoung ? 24 : maxAge ? +maxAge : undefined,
      gender: gender as Gender | undefined,
      page: searchProfileDto.page,
      limit: searchProfileDto.limit,
    };
    return this.findAll(getProfileDto, baseUrl);
  }

  update(id: number, updateProfileDto: UpdateProfileDto) {
    console.log(updateProfileDto);
    return `This action updates a #${id} profile`;
  }

  async remove(id: string) {
    await this.deleteProfile({ id }).catch((e) => {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code == 'P2025'
      ) {
        throw new BadRequestException('Profile does not exist');
      }
      throw e;
    });
  }
  private getAgeGroup(age: number) {
    if (age <= 12) {
      return AgeGroup.child;
    } else if (age <= 19) {
      return AgeGroup.teenager;
    } else if (age <= 59) {
      return AgeGroup.adult;
    }
    return AgeGroup.senior;
  }
  private async genderize(name: string) {
    const { data } = await firstValueFrom(
      this.httpService
        .get<GenderizeResponse>(`https://api.genderize.io?name=${name}`)
        .pipe(
          catchError((error) => {
            console.log(error);
            throw this.externalApiError('Genderize');
          }),
        ),
    );
    if (data.gender === null || data.count === 0) {
      throw new BadRequestException(
        'No prediction available for the provided name',
      );
    }

    return data;
  }
  private async agify(name: string) {
    const { data } = await firstValueFrom(
      this.httpService
        .get<AgifyResponse>(`https://api.agify.io?name=${name}`)
        .pipe(
          catchError((error) => {
            console.log(error);
            throw this.externalApiError('Agify');
          }),
        ),
    );
    if (data.age === null || data.count === 0) {
      throw new BadRequestException(
        'No prediction available for the provided name',
      );
    }

    return data;
  }
  private async nationalize(name: string) {
    const { data } = await firstValueFrom(
      this.httpService
        .get<NationalizeResponse>(`https://api.nationalize.io?name=${name}`)
        .pipe(
          catchError((error) => {
            console.log(error);
            throw this.externalApiError('Nationalize');
          }),
        ),
    );
    if (data.country.length === 0 || data.count === 0) {
      throw new BadRequestException(
        'No prediction available for the provided name',
      );
    }

    return data;
  }
  private async getCountryName(code: string): Promise<string> {
    const { data } = await firstValueFrom(
      this.httpService
        .get<
          RestCountriesData[]
        >(`https://restcountries.com/v3.1/alpha/${code}`)
        .pipe(
          catchError((error) => {
            console.log(error);
            throw this.externalApiError('RestCountries');
          }),
        ),
    );
    if (data.length === 0 || !data?.[0]?.name.common) {
      throw new BadRequestException(
        'No prediction available for the provided name',
      );
    }

    return data[0].name.common;
  }
  private async getCountryId(name: string): Promise<string> {
    const { data } = await firstValueFrom(
      this.httpService
        .get<
          RestCountriesData[]
        >(`https://restcountries.com/v3.1/name/${name}?fullText=true`)
        .pipe(
          catchError((error) => {
            console.log(error);
            throw this.externalApiError('RestCountries');
          }),
        ),
    );
    if (data.length === 0) {
      throw new BadRequestException(
        'No prediction available for the provided name',
      );
    }

    return data[0].cca2;
  }
  private parseQuery(input: string) {
    const country = input.match(/(?<=from |in )\w+/)?.[0] ?? undefined;
    const ageGroup =
      input.match(/(child|teenager|adult|senior)/)?.[0] ?? undefined;
    const minAge = input.match(/(?<=above )\d+/)?.[0] ?? undefined;
    const maxAge = input.match(/(?<=below )\d+/)?.[0] ?? undefined;
    const gender = input.match(/(male|female)/)?.[0] ?? undefined;
    const isYoung = Boolean(input.match(/young/));

    const result = { country, ageGroup, minAge, maxAge, gender, isYoung };
    return result;
  }
  private externalApiError(name: string) {
    return new BadGatewayException(`${name} returned an invalid response`);
  }
  private async profile(
    profileWhereUniqueInput: Prisma.ProfileWhereUniqueInput,
  ): Promise<Profile | null> {
    return this.prisma.client.profile.findUnique({
      where: profileWhereUniqueInput,
    });
  }
  private async profiles(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.ProfileWhereUniqueInput;
    where?: Prisma.ProfileWhereInput;
    orderBy?: Prisma.ProfileOrderByWithRelationInput;
  }): Promise<Profile[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return await this.prisma.client.profile.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
  }
  private async createProfile(
    data: Prisma.ProfileCreateInput,
  ): Promise<Profile> {
    return this.prisma.client.profile.create({
      data,
    });
  }
  private async deleteProfile(
    profileWhereUniqueInput: Prisma.ProfileWhereUniqueInput,
  ): Promise<Profile> {
    return this.prisma.client.profile.delete({
      where: profileWhereUniqueInput,
    });
  }
}
